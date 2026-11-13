# Inner Circle Vault

Standalone Cloudflare Worker for **https://vault.tochukwunkwocha.com**, independent of the parent Next.js app. No database, KV, frontend framework, external fonts, or third-party scripts. Runtime dependency: `aws4fetch`.

The member dashboard has an Overview with live resource/category/format counts, a Resource library with search, category filters and title sorting, and a Help & access section. Navigation and filters use ordinary links and GET forms, so no client JavaScript or additional dependencies are needed. Only published documents appear in counts, search results, and downloads. Desktop uses a sidebar; mobile uses a compact three-section navigation.

## Local development

Use Node.js 22.18 or newer (Node.js 24 recommended). From this directory:

```sh
npm ci
cp .dev.vars.example .dev.vars
# Edit .dev.vars with a monthly passcode and R2 S3 credentials.
npm run dev
```

Open **http://localhost:8788**. `npm run dev` uses `wrangler.local.toml`, binds only to localhost, and reads the actual private R2 catalog with the read-only S3 credentials in `.dev.vars`. Documents published from the local internal dashboard appear after refreshing the member library. Local preview cookies omit Secure only for HTTP loopback hosts with the explicit `VAULT_LOCAL_PREVIEW` flag. Production cookies always include Secure. Upload a subscriber CSV through the local admin page before testing login. Use an email from that list. Before the first dashboard activation, the local bootstrap code is `local-preview-only`; never use it in production. Once you activate a code in the dashboard, that code also becomes authoritative for local previews. Signing requires real R2 credentials and remote objects to actually download.

```sh
npm test
npm run check
```

Tests exercise authentication, passcode rotation, cookie handling, request validation, failure cases, and independently verify the SigV4 signatures. `check` bundles without deploying. Neither command changes Cloudflare resources.

## Cloudflare prerequisites

The domain must be an active Cloudflare zone in the same account as the Worker. Ensure `vault.tochukwunkwocha.com` is available for the custom domain; review any existing DNS record before changing it. `wrangler.toml` defines the custom domain and disables workers.dev and preview URLs.

Authenticate Wrangler with `npx wrangler login`, or set a suitably scoped `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in your shell/secret manager. Wrangler authentication is separate from the Worker runtime secrets. A Cloudflare **Stream-only** token is insufficient for Workers, DNS, and R2 administration. Use account-scoped Workers Scripts Edit, Workers Routes Edit, zone access for the custom domain, and R2 permissions for bucket administration/uploads as appropriate.

Create the bucket if it does not already exist:

```sh
npx wrangler r2 bucket create inner-circle-vault
```

Use **Standard** storage. In R2 → `inner-circle-vault` → Settings, keep the public development URL disabled and do not attach any public custom domain. The vault custom domain belongs to the Worker, not the bucket. The `VAULT_BUCKET` binding reads the private catalog. Downloads redirect to the S3 endpoint. Dashboard uploads require the CORS policy in `r2-cors.json`.

Create an R2 S3 API token scoped to **Object Read only** for just `inner-circle-vault`. Save its access key ID and secret access key securely. A general Cloudflare API token is not an S3 credential. Upload with a separate administrative identity; the Worker needs no write permission.

## Upload the real template files

These commands upload to remote R2 (`--remote` is important). Replace the local file paths with your approved assets; this project does not invent or bundle template documents.

```sh
npx wrangler r2 object put inner-circle-vault/12-month-reunion-budget.xlsx --file /path/to/12-month-reunion-budget.xlsx --remote --content-type application/vnd.openxmlformats-officedocument.spreadsheetml.sheet --content-disposition 'attachment; filename="12-month-reunion-budget.xlsx"'
npx wrangler r2 object put inner-circle-vault/uk-hr-paper-trail-templates.pdf --file /path/to/uk-hr-paper-trail-templates.pdf --remote --content-type application/pdf --content-disposition 'attachment; filename="uk-hr-paper-trail-templates.pdf"'
npx wrangler r2 object put inner-circle-vault/uk-brand-margin-calculator.xlsx --file /path/to/uk-brand-margin-calculator.xlsx --remote --content-type application/vnd.openxmlformats-officedocument.spreadsheetml.sheet --content-disposition 'attachment; filename="uk-brand-margin-calculator.xlsx"'
```

For ordinary uploads, use the internal dashboard described below. CLI uploads do not automatically add catalog entries. Object keys are case-sensitive. The signer includes a signed Content-Disposition override, and upload metadata also marks each file as an attachment. Missing objects or invalid R2 permissions produce an R2 error after the redirect; local signing cannot detect these conditions.

## Uploading through the internal dashboard

The main Next.js app includes **Internal → Inner Circle Vault** at `/internal/vault`. Owners have access automatically; other admins need this section assigned in Admin Accounts. The page and every API operation enforce the same section permission.

1. Choose a PDF, Excel, Word, PowerPoint, CSV, ZIP, or TXT file (up to 100 MB).
2. Enter its title, category, description, and a unique document ID.
3. Leave **Publish to the member vault** unchecked to save a private draft, or check it to publish.
4. Click Save. Files upload directly to private R2 with a five-minute signed PUT URL; upload progress appears on the button.
5. Use Edit to change metadata, replace the file, or uncheck Publish to hide it.

Files get unique object keys, so replacing a file does not overwrite the old copy. Hiding does not delete stored files. Already issued download URLs last up to 60 seconds. No database migration or redeployment is needed for document changes. Refresh reloads the catalog; conflicts from another tab/admin are rejected rather than overwriting their edits. Unsaved edits are cleared by Refresh.

Set these **server-only** variables on the main website hosting environment and in the root `.env.local` for local development:

```dotenv
VAULT_R2_ACCOUNT_ID="your-cloudflare-account-id"
VAULT_R2_ACCESS_KEY_ID="bucket-scoped-read-write-access-key"
VAULT_R2_SECRET_ACCESS_KEY="bucket-scoped-read-write-secret"
```

Use a separate bucket-scoped **Object Read & Write** credential for the website. Keep the Worker's `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` credential **Object Read only**. Neither is sent to the browser; the browser receives only an expiring URL for one new file. The monthly passcode is unrelated to admin authentication and is not used to authorize uploads.

The dashboard maintains `_vault/catalog.json` in the same private bucket. With the `VAULT_BUCKET` binding configured, the member Worker reads this catalog and exposes only published entries. Missing catalogs show an empty-library message; invalid or unavailable catalogs fail closed. The original `TEMPLATES` array remains a fallback for deployments without a catalog binding, not a second live catalog. The shared catalog validator at `../lib/vault-catalog.ts` is bundled by Wrangler: build from this repo, not a copied Worker folder without its parent library.

The allowed upload origins are `https://tochukwunkwocha.com`, `https://www.tochukwunkwocha.com`, and `http://localhost:3000`. Apply the checked-in policy if setting up a new bucket:

```sh
npx wrangler r2 bucket cors set inner-circle-vault --file r2-cors.json
```

This permits browser PUT requests only; valid signed credentials are still required and the bucket remains private. The localhost member preview and the upload dashboard share the real private catalog, so uploading and publishing during local testing changes R2 content. No Worker deployment is required. The production `wrangler.toml` uses the R2 binding; the development configuration is never used by `npm run deploy`.

For a live storage integration check from the repo root:

```sh
node --env-file=.env.local scripts/smoke-inner-circle-vault.mjs
```

This creates a disposable TXT file, checks browser CORS, signed uploads, catalog conflicts, draft visibility, signed downloads, and credential permissions, then removes its own entry and object. It leaves other documents intact and initializes an empty catalog on a new bucket. Do not use the demo passcode `local-preview-only` in production.

## Production secrets and release

Repository rules require explicit owner authorization before deployment or pushing. The commands below are release instructions, not steps executed during local implementation. `wrangler secret put` can create/update a deployed Worker version, so treat these as release operations too.

```sh
npx wrangler secret put VAULT_PASSCODE
npx wrangler secret put R2_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npm run deploy
```

Each command prompts for its value. `R2_ACCOUNT_ID` is the 32-character Cloudflare account ID, not a bucket or zone ID. Choose a long, random passcode with no leading/trailing whitespace (maximum 512 characters), and pin it in the private Inner Circle Facebook Group. Never commit `.dev.vars`, API tokens, or downloaded operational exports. The parent repo's existing Stream credential is not automatically loaded or reused.

After an authorized release, verify on the custom domain: unauthenticated downloads redirect to login; an incorrect code displays the pinned-post guidance; the correct code plus an email in the current list opens the published resource library; each download returns the correct file with attachment disposition; logout closes access; and a rotated passcode invalidates the old cookie. Check the bucket remains inaccessible without a signed URL.

## Monthly rotation and access model

Use **Internal → Inner Circle Vault → Monthly access code** as the account owner:

1. Click **Generate new code**. This creates a cryptographically random candidate without changing member access.
2. Review it, then click **Activate new code** when ready. Activation immediately replaces the previous code and invalidates existing cookies.
3. Use **Copy code** or **Copy Facebook pinned post**, then update the pinned post in the private subscribers’ group yourself.

The card records when the code was activated and by whom. **Show current code** retrieves the current value only for an authenticated owner. Other admins with vault-document permissions cannot view, generate, or rotate access codes. Competing rotations are rejected using R2’s atomic ETag conditions; refresh before retrying. No code or credential is logged.

The active record is `_vault/access.json` in the existing private bucket, separate from the document catalog. `VAULT_MANAGED_ACCESS = "true"` in both Wrangler configurations enables this source. Each authentication check reads the current record directly, so rotations need no redeployment. Codes stay valid until you rotate them; there is no automatic scheduler or calendar expiry. Both local and production Workers point at the same private access record.

`VAULT_PASSCODE` is only a bootstrap fallback when no R2 access record exists yet. After the first activation, remove that legacy production secret during an authorized release so deleting the R2 record cannot restore an old code. Do not delete `_vault/access.json` as a rotation method. A malformed or unavailable record fails closed instead of falling back. Keep the private bucket and its read-only Worker credentials configured.

The cookie lasts 30 days, has Path=/, HttpOnly, Secure, and SameSite=Strict, and is host-only. It contains an HMAC-signed email and expiry, not the monthly code. Every protected request verifies the signature against the current code and checks the email against the latest subscriber list. Logout expires the same cookie. Previously issued signed downloads can still work for the remainder of their 60-second lifetime.

Members must provide both the monthly code and an approved Facebook account email. This does not verify email ownership: sharing both allows access. There is no Facebook API integration. Access is based on the most recent manually uploaded export, not a real-time subscription check. Previously issued URLs can be reused/shared during their 60-second lifetime, and downloaded files cannot be revoked. Login and download responses use no-store and no-referrer headers; the app does not log secrets or signed URLs. There is no persistent brute-force counter; use a strong random monthly code. Cross-origin form submissions are rejected when browser origin metadata is present.

## Free-tier operation

Use the Workers Free plan and R2 Standard storage within the account-wide free allowances. Workers Free allows 100,000 requests/day. R2 Standard includes 10 GB-month storage, 1 million Class A operations/month, and 10 million Class B operations/month, with free egress. Exceeding R2 allowances can incur charges; this application does not enforce an account-wide spending cap. Avoid enabling paid plans or optional paid services. Downloads go directly from R2 to the browser, keeping Worker CPU and bandwidth use small.

Official references: [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

## Evening subscriber list upload

As the owner, open `/internal/vault` → **Subscriber access list**. Export the latest Facebook subscriber email CSV and select it here. Review the counts of approved, added, removed, and duplicate emails. Check the replacement acknowledgement and click **Replace subscriber list**. This replaces, rather than appends to, the list. Header-only exports are supported to revoke all members, with an explicit empty-list warning. Invalid files leave the previous list intact. Refresh and review again after a competing upload.

Members enter **the email address tied to their Facebook account** plus the monthly code. Case and surrounding spaces are ignored for emails; plus aliases and Gmail dots are not rewritten. New subscribers must wait for the next list upload. The pinned-post clipboard text explains this.

The private `_vault/subscribers.json` record contains normalized emails, source filename, upload time, and uploader. It is readable only by the owner dashboard and Worker, never as a public endpoint. CSV input is limited to 2 MB and 10,000 rows, requires the Facebook `Email address` header, and supports quoted fields, BOM, CRLF, and duplicates. Server validation repeats browser validation. No raw CSV is retained in Git or a public document catalog. Only owners can upload/search the list.

Missing or empty lists deny access; corrupt or unavailable lists fail closed. There is no automatic expiry if an evening upload is missed: the last list remains active, and the dashboard warns after 36 hours. Removal denies existing sessions on their next request. Replacing an unchanged list does not sign retained members out. Monthly code rotation invalidates all sessions. Signed download links already issued may last another 60 seconds; previously downloaded files remain available to their recipients.

Facebook decides whether and when cancelled subscriptions disappear from its export. This system does not claim cancellation detection or billing verification.

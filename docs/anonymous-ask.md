# Anonymous Q&A

Public entry: `/ask`. Moderation: `/internal/questions` (owner access by default; delegated admins need the new Anonymous Q&A page permission).

Current dashboard workflow: new audience and visitor questions are always published with public visibility off (`unlisted`). There is no publication-status picker in the question editor. Use the separate **Public visibility: Off/On** switch in the list or editor; enabling it requires confirmation. Saving text or a Facebook link does not change visibility. Switching off keeps the audience answer link active; unpublishing remains a separate action that disables it. Existing records are not bulk-modified. The status values below describe storage; the toggle is the user-facing control.

**Publish question** creates an audience question with answers enabled and visibility off. Existing drafts and unpublished questions have a separate **Publish question** action that activates the same answer link, reopens audience answers, and leaves visibility off. The visibility toggle only operates on published questions. Copying a published answer link does not depend on visibility, Facebook links, or whether submissions have subsequently been manually closed. A closed question's link shows the closed message until submissions are reopened.

Visitors submit private questions. In the dashboard, choose a question, paste the URL of your answer on your Facebook profile, and select Published. Questions can also be published while awaiting an answer. The website displays the question and a Facebook link; it does not post to Facebook or import Facebook comments.

Questions have two publication choices: **Published — hidden from public** (stored as `unlisted`) and **Published — visible on /ask** (stored as `published`). A Facebook link is optional in either mode. Hidden publication activates an audience question's answer link without exposing the question or approved answers on the public feed or full question page. Anyone with the answer link can see the prompt and submit if answers are open; it is unlisted, not access-controlled. Adding a Facebook link later does not change visibility. Select the visible publication option explicitly when ready. Existing published questions remain visible. This uses the existing string status column and requires no migration.

Both visible and hidden published questions have an **Unpublish question** button in the list and editor. It moves the question to Draft, hides it and its responses from public pages, and deactivates the answer link. Content and responses are retained. To republish, open Manage question, select either publication option, and save.

Private questions (draft, pending, or archived) have a **Delete question** button in both the list and editor. After confirmation, deletion permanently removes the question and all its answers. Published questions must be unpublished first; this rule and stale-edit protection are enforced atomically on the server. Deleted question and answer links return 404. This does not delete any linked Facebook post.

Under Your audience questions, create a prompt and publish it with Accept anonymous answers enabled. Visitors can submit one-level responses. Review these under Anonymous answers and publish selected contributions. Draft, pending and archived items are private. Unpublishing a prompt hides all its responses. Closing submissions keeps the published question and approved answers readable.

Each published question has its own shareable `/ask/{id}` URL. Published responses are paginated. No public replies, accounts, notifications or conversation threads are added. Existing course-player conversations are unchanged.

Audience questions also have a dedicated `/ask/{id}/answer` link. Use **Copy answer link** in the dashboard's question list or editor to paste it into Facebook comments. This page shows only the prompt and a compact anonymous answer form, outside the main public layout (no navigation, footer, feed or promotional popups). It fetches no existing responses. The same submission endpoint and moderation controls apply. Unpublished or non-prompt links return 404; closed prompts show a closed message without a form. After sending, the form is replaced with a confirmation. Copying is enabled only for published questions accepting answers. Local dashboard links use the local origin and are labelled for testing; copy from the deployed website for real Facebook sharing.

## Database rollout

The Q&A-only SQL migration has now been applied to the configured `linescout` database at the user's request for local testing. All three tables were verified through Prisma and were empty after setup. The local app uses this remote database, so local submissions persist there. No website deployment was performed.

The additive migration is `prisma/migrations/20260924120000_add_anonymous_ask/migration.sql`. It creates only `ask_questions`, `ask_answers`, and `ask_rate_limits`. There are no changes to existing tables.

Apply this migration through the site's established database release process before deploying the feature. For installations that use targeted SQL setup rather than Prisma migration history, use `npx prisma db execute --file prisma/migrations/20260924120000_add_anonymous_ask/migration.sql --schema prisma/schema.prisma` against the intended database. Do not blindly deploy unrelated pending migrations or use `db push` against this existing database. Generate the Prisma client with `npx prisma generate` (also run by the existing postinstall script).

Production requires the existing `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY` configuration. `/api/ask` fails closed if CAPTCHA is disabled or unconfigured in production; other forms retain their current behaviour. This feature adds no new credentials or dependencies.

The new route can be shared directly. Existing public navigation is unchanged; the internal sidebar gets one new link. The existing lead-capture popup is excluded only from `/ask` so it does not ask anonymous contributors for contact details.

## Privacy and anti-abuse

Content records contain no author account, name, email, IP, or user agent. Visitors are told approved content may be shared here and on Facebook. Avoid identifying details in submissions. Hosting logs, existing site analytics and reCAPTCHA are subject to their own data processing; this is not a promise of untraceability.

An independent rate-limit table stores hourly keyed HMAC counters, never linked to questions or answers. Five attempts per network address per hour are allowed across server instances. Keys expire hourly, with expired rows deleted on the next rate-limit request. The existing CAPTCHA secret (or database URL in local development) keys the HMAC. The host must provide a trustworthy client-IP header. Honeypot, same-origin checks, a 16 KB request limit, text bounds and plain-text rendering add further protection.

The API returns generic storage errors without echoing content or database details. Pending content is excluded at query time, including response counts. Published page reads are dynamic so unpublishing takes effect on the next request. Moderation actions independently check page permissions and reject stale updates.

## Verification

Run `node --test tests/ask.test.mjs` and `npm run typecheck`. The focused tests exercise the actual validation, service, API and moderation code with explicit database/framework doubles; they do not access a live database. A release smoke test should use an isolated MySQL database to verify the migration, question submission, publishing, anonymous response moderation, Facebook links, and unpublishing end to end before production rollout.

Initial browser verification used a disposable in-memory Prisma fixture injected into the development process from `/private/tmp`, with the database URL pointing to an unused localhost port. It exercised anonymous questions and responses, login protection, prompt creation, preservation of input after validation errors, publication, closing responses, unpublishing, private-page 404s, and Facebook link destinations. A 390-pixel mobile viewport had no horizontal overflow. No fixture hook or sample content is included in application code. After applying the migration, the real database connection, empty public page with its submission form, and dashboard login redirect were verified locally without creating sample submissions.

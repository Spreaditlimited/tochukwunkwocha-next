# SEO Opportunities

The single Next.js app owns both sides of the workflow:

1. `/api/seo/search-console/import` starts and reports authenticated manual Google Search Console imports.
2. `/api/cron/search-console` supports optional scheduled imports protected by a bearer secret.
3. `/internal/seo` shows import progress, scored opportunities, filters, and proposal actions.
   It also surfaces `new_content` opportunities when a meaningful multi-word query has demand but no existing blog post provides substantial coverage. Starting an article prefills its title and focus keyword and links the saved draft back to the opportunity.
4. A proposal uses strict structured output and remains unpublished.
5. A separate background OpenAI response researches and rewrites the full article. Its response ID is checkpointed and status polling never starts a second paid generation.
6. Existing external citations must be retained or explicitly replaced. Newly introduced internal URLs require one-time or global approval.
7. The review page compares original and proposed HTML. Only the final Apply action updates the post, metadata, social metadata, keywords, and FAQ.

## Database setup

Run after setting `DATABASE_URL`:

```sh
npm run db:setup:seo
```

This is safe to rerun. It creates the import, opportunity, change-log, link-registry, rewrite-artifact, and pipeline-attempt tables, adds newer columns to an older installation, and seeds the approved internal-link catalog.

## Environment

Use one Search Console credential format:

```txt
GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON_BASE64=
```

or:

```txt
GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON=
```

or the split fields:

```txt
GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL=
GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY=
```

Also configure:

```txt
GOOGLE_SEARCH_CONSOLE_SITE_URL=sc-domain:tochukwunkwocha.com
GOOGLE_SEARCH_CONSOLE_CRON_SECRET=
SEO_MIN_GSC_IMPRESSIONS=50
SEO_MIN_GSC_NEW_CONTENT_IMPRESSIONS=20
OPENAI_API_KEY=
SEO_AUTOMATION_MODEL=gpt-5
SEO_CONTENT_REWRITE_MODEL=gpt-5.6-sol
SEO_AUTOPUBLISH_ENABLED=false
```

`GOOGLE_SEARCH_CONSOLE_CRON_SECRET` falls back to `CRON_SECRET`. Keep `SEO_AUTOPUBLISH_ENABLED=false`; automatic publishing is intentionally unavailable and every researched rewrite requires explicit administrator review and application.

## Optional cron

Call the endpoint with the secret:

```txt
GET /api/cron/search-console?days=3
Authorization: Bearer <GOOGLE_SEARCH_CONSOLE_CRON_SECRET>
```

Google Search Console normally lags, so automatic and manual imports accept data only through two days ago.

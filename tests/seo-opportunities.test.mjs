import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { findNewUnapprovedLinks, normalizeLinkableUrl, reviseInternalLinkInHtml } from "../lib/seo/link-policy.ts"
import { validateExternalLinkContinuity } from "../lib/seo/external-link-policy.ts"

const review = await readFile(new URL("../lib/seo-review.ts", import.meta.url), "utf8")
const statusRoute = await readFile(new URL("../app/api/seo/changes/[pidChange]/rewrite-status/route.ts", import.meta.url), "utf8")
const importRoute = await readFile(new URL("../app/api/seo/search-console/import/route.ts", import.meta.url), "utf8")
const cronImportRoute = await readFile(new URL("../app/api/cron/search-console/route.ts", import.meta.url), "utf8")
const importer = await readFile(new URL("../lib/search-console.ts", import.meta.url), "utf8")
const vercelConfig = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"))
const seoWorkflow = await readFile(new URL("../lib/seo.ts", import.meta.url), "utf8")
const seoQueue = await readFile(new URL("../app/(internal)/internal/(admin)/seo/page.tsx", import.meta.url), "utf8")
const newBlogPage = await readFile(new URL("../app/(internal)/internal/(admin)/blog/new/page.tsx", import.meta.url), "utf8")
const rewriteProgress = await readFile(new URL("../app/(internal)/internal/(admin)/seo/RewriteProgress.tsx", import.meta.url), "utf8")
const generateDraftButton = await readFile(new URL("../app/(internal)/internal/(admin)/seo/GenerateDraftButton.tsx", import.meta.url), "utf8")
const seoActions = await readFile(new URL("../app/(internal)/internal/(admin)/seo/actions.ts", import.meta.url), "utf8")
const changeReviewPage = await readFile(new URL("../app/(internal)/internal/(admin)/seo/changes/[pidChange]/page.tsx", import.meta.url), "utf8")
const globalStyles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8")
const blogEditor = await readFile(new URL("../components/BlogContentEditor.tsx", import.meta.url), "utf8")
const linkCatalog = await readFile(new URL("../lib/seo/link-catalog.ts", import.meta.url), "utf8")
const seoSetup = await readFile(new URL("../scripts/setup-seo-tables.mjs", import.meta.url), "utf8")

test("internal URL normalization and approvals are scoped", () => {
  assert.equal(normalizeLinkableUrl("https://www.tochukwunkwocha.com/schools/?ref=blog#form"), "/schools")
  assert.equal(normalizeLinkableUrl("https://example.com/schools"), null)
  assert.deepEqual(findNewUnapprovedLinks({ originalHtml: '<a href="/blog">Blog</a>', rewrittenHtml: '<a href="/blog">Blog</a><a href="/schools">Schools</a>', approvedUrls: [] }).pending, ["/schools"])
  assert.deepEqual(findNewUnapprovedLinks({ originalHtml: "", rewrittenHtml: '<a href="/schools">Schools</a>', approvedUrls: [], decisions: { "/schools": "once" } }).pending, [])
})

test("Prompt to Profit Advanced is available in the approved link catalog", () => {
  assert.match(linkCatalog, /Prompt to Profit Advanced[^\n]*\/courses\/prompt-to-production/)
  assert.match(seoSetup, /SEOLINK_PROMPT_TO_PRODUCTION[^\n]*\/courses\/prompt-to-production[^\n]*Prompt to Profit Advanced/)
})

test("Build Service is available in the approved link catalog", () => {
  assert.match(linkCatalog, /Build Service[^\n]*\/build/)
  assert.match(seoSetup, /SEOLINK_BUILD_SERVICE[^\n]*\/build[^\n]*Build Service/)
})

test("internal link review can reject an anchor or amend it to an approved destination", () => {
  const html = '<p>Read <a class="article-link" href="/schools">our schools guide</a>.</p>'
  assert.equal(reviseInternalLinkInHtml({ html, originalUrl: "/schools" }), "<p>Read our schools guide.</p>")
  assert.equal(reviseInternalLinkInHtml({ html, originalUrl: "/schools", replacementUrl: "/resources" }), '<p>Read <a class="article-link" href="/resources">our schools guide</a>.</p>')
})

test("external citations cannot silently disappear", () => {
  assert.throws(() => validateExternalLinkContinuity({ originalHtml: '<a href="https://developers.google.com/search">Google</a>', rewrittenHtml: "<p>No citation</p>" }), /External link preservation failed/)
  assert.doesNotThrow(() => validateExternalLinkContinuity({ originalHtml: '<a href="https://developers.google.com/search">Google</a>', rewrittenHtml: '<a href="https://developers.google.com/search">Google</a>' }))
})

test("rewritten article links use one accessible public rendering contract", () => {
  assert.match(globalStyles, /\.blog-content a \{[\s\S]*break-words[\s\S]*decoration-2[\s\S]*focus-visible:ring-2/)
  assert.match(globalStyles, /\.blog-content aside a \{[\s\S]*text-sky-200[\s\S]*decoration-sky-300\/80[\s\S]*hover:text-white/)
  assert.doesNotMatch(blogEditor, /class: "font-bold text-primary underline underline-offset-2"/)
  assert.match(review, /no markdown fences, scripts, styles, presentational class attributes/)
})

test("rewrite generation is background, researched, checkpointed, and separate from apply", () => {
  const generation = review.split("async function startRewrite")[1].split("async function retrieveRewrite")[0]
  const apply = review.split("export async function applySeoMetadataChange")[1].split("export async function approveSeoRewriteLink")[0]
  assert.match(generation, /background: true/)
  assert.match(generation, /web_search/)
  assert.match(generation, /reasoning: \{ effort: "high" \}/)
  assert.match(review, /openAiResponseId/)
  assert.doesNotMatch(apply, /startRewrite/)
  assert.match(apply, /validateExternalLinkContinuity|saveArtifact/)
})

test("status polling resumes only and manual GSC imports require admin authorization", () => {
  assert.match(statusRoute, /allowStart: false/)
  assert.match(importRoute, /getAdminSession/)
  assert.doesNotMatch(importRoute, /manual_json|body\?\.rows/)
})

test("Search Console imports run daily through an authenticated Vercel cron", () => {
  assert.deepEqual(
    vercelConfig.crons.find((cron) => cron.path === "/api/cron/search-console"),
    { path: "/api/cron/search-console", schedule: "15 6 * * *" }
  )
  assert.match(cronImportRoute, /process\.env\.CRON_SECRET/)
  assert.match(cronImportRoute, /process\.env\.GOOGLE_SEARCH_CONSOLE_CRON_SECRET/)
  assert.match(cronImportRoute, /authorization === `Bearer \$\{secret\}`/)
})

test("actionable queries are reduced to one highest-impression opportunity per blog page", () => {
  assert.match(importer, /candidatesByPage/)
  assert.match(importer, /right\.impressions - left\.impressions/)
  assert.match(importer, /impressions < min/)
  assert.match(importer, /weightedPosition/)
  assert.match(importer, /queryCluster: ranked\.map/)
  assert.match(importer, /pageCandidates\.slice\(0, 50\)/)
})

test("an article cannot have duplicate active opportunities or paid drafts", () => {
  assert.match(importer, /opportunity\.status === "reviewing"/)
  assert.match(importer, /status: \{ in: \["open", "reviewing"\] \}/)
  assert.match(seoWorkflow, /pidBlog: opportunity\.blog\.pidBlog, status: \{ notIn: \["applied", "rejected"\] \}/)
  assert.match(seoWorkflow, /reused: true/)
  assert.match(seoWorkflow, /status: "dismissed"/)
})

test("uncovered Search Console demand creates tracked new-article opportunities", () => {
  assert.match(importer, /SEO_MIN_GSC_NEW_CONTENT_IMPRESSIONS/)
  assert.match(importer, /hasMeaningfulBlogCoverage/)
  assert.match(importer, /opportunityType: "new_content"/)
  assert.match(importer, /blogCoverage >= 0\.25/)
  assert.match(seoQueue, /Start New Article/)
  assert.match(seoQueue, /Current Ranking Page/)
  assert.match(newBlogPage, /focusKeyword/)
  assert.match(seoWorkflow, /attachNewContentOpportunity/)
})

test("draft and article rewrite actions expose visible progress without duplicate generation", () => {
  assert.match(generateDraftButton, /Generating Draft/)
  assert.match(generateDraftButton, /seo-draft-progress/)
  assert.match(rewriteProgress, /Actual OpenAI status/)
  assert.match(rewriteProgress, /elapsed/)
  assert.match(rewriteProgress, /Last checked/)
  assert.match(rewriteProgress, /Request checkpointed/)
  assert.match(rewriteProgress, /Research and article rewrite/)
  assert.match(statusRoute, /elapsedSeconds/)
  assert.match(statusRoute, /progressFor/)
})

test("internal link suggestions support persistent rejection, amendment, and prompt feedback", () => {
  assert.match(changeReviewPage, /Keep suggestion/)
  assert.match(changeReviewPage, /Reject suggestion/)
  assert.match(changeReviewPage, /Amend destination/)
  assert.match(changeReviewPage, /Optional editor note/)
  assert.match(seoActions, /saveSeoInternalLinkSuggestionFeedback/)
  assert.match(seoActions, /reviewSeoRewriteLink/)
  assert.match(review, /internalLinkFeedback/)
  assert.match(review, /undeliverable|Never restore a rejected suggestion|binding/)
  assert.match(seoWorkflow, /getSeoInternalLinkEditorialGuidance/)
  assert.match(seoWorkflow, /Prior editorial internal-link guidance/)
})

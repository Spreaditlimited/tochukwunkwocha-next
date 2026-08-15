import crypto from "crypto"

import { parseBlogSeo } from "@/lib/blog"
import { prisma } from "@/lib/prisma"
import { safeJsonParse } from "@/lib/utils"
import { extractExternalUrls, validateExternalLinkContinuity, type ExternalLinkChange } from "@/lib/seo/external-link-policy"
import { getSeoLinkCatalog, type SeoLinkCatalogItem } from "@/lib/seo/link-catalog"
import { findNewUnapprovedLinks, normalizeLinkableUrl, type LinkApprovalDecision } from "@/lib/seo/link-policy"

export const SEO_REWRITE_QUALITY_POLICY_VERSION = "2026-08-external-research-global-v1"

type JsonRecord = Record<string, unknown>
type OpenAiResponsePayload = { id?: string; status?: string; model?: string; output_text?: string; output?: Array<{ content?: Array<{ text?: unknown }> }>; error?: { message?: string }; incomplete_details?: { reason?: string } }

function jsonObject(value: string | null) { return safeJsonParse<JsonRecord>(value, {}) }
function jsonArray<T = unknown>(value: string | null) { return safeJsonParse<T[]>(value, []) }
function truncate(value: string, max: number) { return value.length <= max ? value : `${value.slice(0, max - 3)}...` }
function contentHash(value: string | null) { return crypto.createHash("sha256").update(String(value || "")).digest("hex") }
function strings(value: unknown) { return Array.isArray(value) ? value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean) : [] }
function objects(value: unknown) { return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as JsonRecord[] : [] }
function escapeHtml(value: unknown) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;") }

function extractJson(value: string) {
  const trimmed = value.trim(), start = trimmed.indexOf("{"), end = trimmed.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("AI response did not include a JSON object.")
  return JSON.parse(trimmed.slice(start, end + 1))
}

function faqHtml(value: unknown, pidChange: string) {
  const items = objects(value).map((item) => ({ question: String(item.question || "").trim(), answer: String(item.answer || "").trim() })).filter((item) => item.question && item.answer)
  if (!items.length) return ""
  return `<!-- tochukwu-seo-faq:start:${escapeHtml(pidChange)} -->\n<section class="tochukwu-seo-faq" data-seo-change="${escapeHtml(pidChange)}">\n<h2>Frequently Asked Questions</h2>\n${items.map((item) => `<div class="tochukwu-seo-faq-item"><h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p></div>`).join("\n")}\n</section>\n<!-- tochukwu-seo-faq:end -->`
}

function removeGeneratedFaq(value: string | null) { return String(value || "").replace(/<!-- tochukwu-seo-faq:start:[\s\S]*?<!-- tochukwu-seo-faq:end -->/g, "").trim() }

export async function getSeoChangeReview(pidChange: string) {
  const change = await prisma.tochukwuSeoContentChangeLog.findUnique({ where: { pidChange }, include: { blog: true, opportunity: true } })
  if (!change) return null
  const artifact = await prisma.tochukwuSeoRewriteArtifact.findUnique({ where: { pidChange } })
  const attempt = await prisma.tochukwuSeoPipelineAttempt.findFirst({ where: { pidChange, stage: "rewrite", status: "started" }, orderBy: { createdAt: "desc" } })
  return {
    ...change,
    before: jsonObject(change.beforeJson), after: jsonObject(change.afterJson), validation: jsonObject(change.validationJson),
    blogTitle: change.blog?.blogTitle || null, blogSlug: change.blog?.blogSlug || null, blogContent: change.blog?.blogContent || null, blogExt2: change.blog?.blogExt2 || null,
    pageUrl: change.opportunity?.pageUrl || null, opportunityType: change.opportunity?.opportunityType || null,
    primaryQuery: change.opportunity?.primaryQuery || null, recommendation: change.opportunity?.recommendation || null, recommendedCta: change.opportunity?.recommendedCta || null,
    artifactStatus: artifact?.status || null, sourceContentHash: artifact?.sourceContentHash || null,
    rewrittenHtml: artifact?.rewrittenHtml || null, appliedChanges: jsonArray<string>(artifact?.appliedChangesJson || null),
    discoveredLinks: jsonArray<string>(artifact?.discoveredLinksJson || null), pendingLinks: jsonArray<string>(artifact?.pendingLinksJson || null),
    linkDecisions: jsonObject(artifact?.decisionsJson || null) as Record<string, LinkApprovalDecision>,
    externalLinkChanges: jsonArray<ExternalLinkChange>(artifact?.externalLinkChangesJson || null),
    rewritePolicyCurrent: artifact?.qualityPolicyVersion === SEO_REWRITE_QUALITY_POLICY_VERSION,
    openAiResponseId: artifact?.openAiResponseId || null, openAiResponseStatus: artifact?.openAiResponseStatus || null,
    openAiModel: artifact?.openAiModel || null, artifactErrorMessage: artifact?.errorMessage || null,
    rewriteAttemptCount: artifact?.attemptCount || 0, rewriteGeneratedAt: artifact?.generatedAt || null,
    rewriteStartedAt: attempt?.startedAt || null
  }
}

type ChangeReview = NonNullable<Awaited<ReturnType<typeof getSeoChangeReview>>>

const rewriteSchema = {
  type: "object",
  properties: {
    html: { type: "string" }, appliedChanges: { type: "array", items: { type: "string" } },
    externalLinkChanges: { type: "array", items: { type: "object", properties: { originalUrl: { type: "string" }, action: { type: "string", enum: ["retained", "replaced"] }, replacementUrl: { type: "string" }, reason: { type: "string" } }, required: ["originalUrl", "action", "replacementUrl", "reason"], additionalProperties: false } }
  },
  required: ["html", "appliedChanges", "externalLinkChanges"], additionalProperties: false
}

function rewritePrompt(change: ChangeReview, catalog: SeoLinkCatalogItem[]) {
  const after = change.after, approved = new Set(catalog.map((item) => item.url))
  const internalLinks = objects(after.internalLinks).filter((item) => approved.has(String(item.url || "")))
  const original = removeGeneratedFaq(change.blogContent)
  return `Rewrite and improve this Tochukwu Tech and AI Academy blog post HTML using the approved SEO content brief.

Critical rules:
- Return only valid JSON matching the requested schema: full article HTML, concise appliedChanges, and an externalLinkChanges audit.
- Apply every useful content brief item while preserving valuable original depth, examples, steps, media, intent, and factual meaning.
- Use current web research for claims and citations that may have changed. Prefer official and primary sources, then authoritative specialist sources.
- Never invent a fact, statistic, price, date, policy, feature, guarantee, citation, or URL. Soften unverified claims.
- Preserve every useful existing external link. Replace one only when research shows a better source; document it and include the replacement in the HTML.
- Add authoritative external citations when they materially help readers verify a claim or continue their research.
- Write primarily for Nigerian students, parents, teachers, professionals, teams, and small businesses, while explaining local context so the article remains useful globally.
- Use clear, practical, specific prose. Keep valid semantic HTML only; no markdown fences, scripts, styles, presentational class attributes, or FAQ section. Link appearance is controlled by the site's shared article stylesheet.
- Add internal links naturally and only from the exact approved catalog below. Do not invent routes.
- Do not change the blog title unless it already appears as a heading in the body.

Metadata: title=${after.metaTitle || ""}; description=${after.metaDescription || ""}; keyword=${after.focusKeyword || ""}; CTA=${after.ctaIntent || change.recommendedCta || ""}

Content brief:\n${strings(after.contentBrief).map((item, i) => `${i + 1}. ${item}`).join("\n") || "None"}

Suggested internal links:\n${internalLinks.map((item, i) => `${i + 1}. ${item.label || ""}: ${item.url} (${item.reason || ""})`).join("\n") || "None"}

Approved catalog:\n${catalog.map((item, i) => `${i + 1}. ${item.label}: ${item.url} - ${item.useWhen}`).join("\n")}

Risk notes:\n${strings(after.riskNotes).map((item, i) => `${i + 1}. ${item}`).join("\n") || "None"}

Existing external links to retain or explicitly replace:\n${extractExternalUrls(original).join("\n") || "None. Add authoritative citations when useful."}

Article title: ${change.blogTitle || "Untitled"}
Current HTML:\n${original}`
}

function apiKey() { const key = process.env.OPENAI_API_KEY; if (!key) throw new Error("Missing OPENAI_API_KEY."); return key }

async function startRewrite(change: ChangeReview, catalog: SeoLinkCatalogItem[], idempotencyKey: string) {
  const model = process.env.SEO_CONTENT_REWRITE_MODEL || "gpt-5.6-sol"
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({ model, background: true, reasoning: { effort: "high" }, tools: [{ type: "web_search" }], max_tool_calls: 6, max_output_tokens: 40_000,
      input: [{ role: "system", content: "You are a senior research editor for Tochukwu Tech and AI Academy. Produce authoritative, deeply useful, Nigeria-aware and globally accessible article rewrites grounded in current research. Preserve citations and never invent facts or links." }, { role: "user", content: rewritePrompt(change, catalog) }],
      text: { format: { type: "json_schema", name: "tochukwu_content_rewrite", schema: rewriteSchema, strict: true } } })
  })
  if (!response.ok) throw new Error(`OpenAI content rewrite failed: ${response.status} ${truncate(await response.text(), 240)}`)
  return response.json() as Promise<OpenAiResponsePayload>
}

async function retrieveRewrite(responseId: string) {
  const response = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`, { headers: { Authorization: `Bearer ${apiKey()}` }, signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`OpenAI rewrite status check failed: ${response.status} ${truncate(await response.text(), 240)}`)
  return response.json() as Promise<OpenAiResponsePayload>
}

function parseRewrite(payload: OpenAiResponsePayload, change: ChangeReview) {
  if (payload?.status !== "completed") throw new Error(`OpenAI rewrite is not complete (status: ${payload?.status || "unknown"}).`)
  const content = typeof payload.output_text === "string" ? payload.output_text : payload.output?.flatMap((item) => item.content || []).map((item) => item.text).filter((item): item is string => typeof item === "string").join("")
  if (!content) throw new Error("OpenAI response did not include rewritten content.")
  const parsed = extractJson(content), html = String(parsed.html || "").trim()
  if (html.length < 500) throw new Error("AI rewrite returned content that is too short to apply safely.")
  const externalLinkChanges = objects(parsed.externalLinkChanges).filter((item) => typeof item.originalUrl === "string" && typeof item.action === "string" && ["retained", "replaced"].includes(item.action) && typeof item.replacementUrl === "string" && typeof item.reason === "string") as ExternalLinkChange[]
  validateExternalLinkContinuity({ originalHtml: change.blogContent, rewrittenHtml: html, changes: externalLinkChanges })
  return { html, appliedChanges: strings(parsed.appliedChanges), externalLinkChanges }
}

async function beginAttempt(change: ChangeReview, sourceHash: string) {
  const now = new Date(), pidAttempt = `seo_attempt_${crypto.randomUUID()}`
  await prisma.$transaction([
    prisma.tochukwuSeoRewriteArtifact.upsert({ where: { pidChange: change.pidChange }, create: { pidArtifact: `seo_artifact_${crypto.randomUUID()}`, pidChange: change.pidChange, sourceContentHash: sourceHash, status: "rewriting", attemptCount: 1, createdAt: now, updatedAt: now }, update: { sourceContentHash: sourceHash, rewrittenHtml: null, appliedChangesJson: null, discoveredLinksJson: null, pendingLinksJson: null, decisionsJson: null, externalLinkChangesJson: null, qualityPolicyVersion: null, openAiResponseId: null, openAiResponseStatus: null, openAiModel: null, status: "rewriting", errorCode: null, errorMessage: null, generatedAt: null, reviewedAt: null, appliedAt: null, attemptCount: { increment: 1 }, updatedAt: now } }),
    prisma.tochukwuSeoContentChangeLog.update({ where: { pidChange: change.pidChange }, data: { status: "rewriting", updatedAt: now } }),
    prisma.tochukwuSeoPipelineAttempt.create({ data: { pidAttempt, pidChange: change.pidChange, stage: "rewrite", status: "started", detailsJson: JSON.stringify({ sourceContentHash: sourceHash }), startedAt: now, createdAt: now, updatedAt: now } })
  ])
  return pidAttempt
}

async function saveArtifact(input: { change: ChangeReview; html: string; appliedChanges: string[]; externalLinkChanges: ExternalLinkChange[]; decisions: Record<string, LinkApprovalDecision>; attemptId?: string }) {
  const catalog = await getSeoLinkCatalog()
  validateExternalLinkContinuity({ originalHtml: input.change.blogContent, rewrittenHtml: input.html, changes: input.externalLinkChanges })
  const links = findNewUnapprovedLinks({ originalHtml: input.change.blogContent, rewrittenHtml: input.html, approvedUrls: catalog.map((item) => item.url), decisions: input.decisions })
  const now = new Date(), status = links.pending.length ? "awaiting_link_review" : "ready"
  await prisma.$transaction([
    prisma.tochukwuSeoRewriteArtifact.update({ where: { pidChange: input.change.pidChange }, data: { rewrittenHtml: input.html, appliedChangesJson: JSON.stringify(input.appliedChanges), externalLinkChangesJson: JSON.stringify(input.externalLinkChanges), qualityPolicyVersion: SEO_REWRITE_QUALITY_POLICY_VERSION, openAiResponseStatus: "completed", discoveredLinksJson: JSON.stringify(links.discovered), pendingLinksJson: JSON.stringify(links.pending), decisionsJson: JSON.stringify(input.decisions), status, errorCode: null, errorMessage: null, generatedAt: input.change.rewriteGeneratedAt || now, reviewedAt: links.pending.length ? null : now, updatedAt: now } }),
    prisma.tochukwuSeoContentChangeLog.update({ where: { pidChange: input.change.pidChange }, data: { status: links.pending.length ? "awaiting_link_review" : "rewrite_ready", updatedAt: now } }),
    ...(input.attemptId ? [prisma.tochukwuSeoPipelineAttempt.update({ where: { pidAttempt: input.attemptId }, data: { status: "completed", detailsJson: JSON.stringify({ discoveredLinks: links.discovered, pendingLinks: links.pending, qualityPolicyVersion: SEO_REWRITE_QUALITY_POLICY_VERSION }), completedAt: now, updatedAt: now } })] : [])
  ])
  return links
}

function assertReviewable(change: ChangeReview) {
  if (!change.pidBlog || !change.blog) throw new Error("SEO draft is not attached to a blog post.")
  if (change.status === "rejected") throw new Error("SEO draft has been rejected.")
  if (change.validation.ok === false) throw new Error("Resolve the stored SEO draft validation errors before continuing.")
}

export async function prepareSeoRewrite(pidChange: string, options: { allowStart?: boolean } = {}) {
  const change = await getSeoChangeReview(pidChange); if (!change) throw new Error("SEO draft was not found.")
  assertReviewable(change); if (change.status === "applied") throw new Error("This SEO draft has already been applied.")
  const sourceHash = contentHash(change.blogContent)
  const canReuse = Boolean(change.rewrittenHtml) && change.sourceContentHash === sourceHash && change.rewritePolicyCurrent && !["discarded", "failed"].includes(change.artifactStatus || "")
  const canResume = Boolean(change.openAiResponseId) && change.sourceContentHash === sourceHash && change.artifactStatus === "rewriting"
  let html = change.rewrittenHtml, appliedChanges = change.appliedChanges, externalChanges = change.externalLinkChanges, decisions = change.linkDecisions, attemptId: string | undefined
  if (!canReuse) {
    if (options.allowStart === false && !canResume) throw new Error("There is no matching background rewrite to resume.")
    attemptId = canResume ? (await prisma.tochukwuSeoPipelineAttempt.findFirst({ where: { pidChange, stage: "rewrite", status: "started" }, orderBy: { createdAt: "desc" } }))?.pidAttempt : undefined
    if (!attemptId) attemptId = await beginAttempt(change, sourceHash)
    try {
      const catalog = await getSeoLinkCatalog(), payload = canResume && change.openAiResponseId ? await retrieveRewrite(change.openAiResponseId) : await startRewrite(change, catalog, attemptId)
      const responseId = String(payload?.id || change.openAiResponseId || ""), responseStatus = String(payload?.status || "unknown"), model = String(payload?.model || process.env.SEO_CONTENT_REWRITE_MODEL || "gpt-5.6-sol")
      if (!responseId) throw new Error("OpenAI background rewrite did not return a response ID.")
      await prisma.$transaction([
        prisma.tochukwuSeoRewriteArtifact.update({ where: { pidChange }, data: { openAiResponseId: responseId, openAiResponseStatus: responseStatus, openAiModel: model, status: "rewriting", updatedAt: new Date() } }),
        prisma.tochukwuSeoPipelineAttempt.update({ where: { pidAttempt: attemptId }, data: { detailsJson: JSON.stringify({ openAiResponseId: responseId, openAiResponseStatus: responseStatus, model }), updatedAt: new Date() } })
      ])
      if (["queued", "in_progress"].includes(responseStatus)) return { status: "processing" as const, pendingLinks: [] as string[] }
      if (responseStatus !== "completed") throw new Error(`OpenAI background rewrite ended with ${responseStatus}: ${payload?.error?.message || payload?.incomplete_details?.reason || responseStatus}`)
      const rewrite = parseRewrite(payload, change); html = rewrite.html; appliedChanges = rewrite.appliedChanges; externalChanges = rewrite.externalLinkChanges; decisions = {}
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!/fetch failed|status check failed: (?:429|5\d\d)/i.test(message)) {
        const now = new Date()
        await prisma.$transaction([
          prisma.tochukwuSeoRewriteArtifact.update({ where: { pidChange }, data: { status: "failed", errorCode: "rewrite_failed", errorMessage: truncate(message, 2000), updatedAt: now } }),
          prisma.tochukwuSeoContentChangeLog.update({ where: { pidChange }, data: { status: "rewrite_failed", updatedAt: now } }),
          prisma.tochukwuSeoPipelineAttempt.update({ where: { pidAttempt: attemptId }, data: { status: "failed", errorCode: "rewrite_failed", errorMessage: truncate(message, 2000), completedAt: now, updatedAt: now } })
        ])
      }
      throw error
    }
  }
  if (!html) throw new Error("The saved rewrite artifact is missing its HTML content.")
  const links = await saveArtifact({ change, html, appliedChanges, externalLinkChanges: externalChanges, decisions, attemptId })
  return links.pending.length ? { status: "awaiting_link_review" as const, pendingLinks: links.pending } : { status: "ready" as const, pendingLinks: [] as string[] }
}

export async function applySeoMetadataChange(pidChange: string) {
  const change = await getSeoChangeReview(pidChange); if (!change) throw new Error("SEO draft was not found.")
  assertReviewable(change); if (change.status === "applied") return { status: "already_applied" as const, pendingLinks: [] as string[] }
  const sourceHash = contentHash(change.blogContent)
  if (!change.rewrittenHtml || change.sourceContentHash !== sourceHash || !change.rewritePolicyCurrent || ["discarded", "failed"].includes(change.artifactStatus || "")) throw new Error("Generate and review an article rewrite that meets the current research and link-preservation policy before applying this SEO draft.")
  const links = await saveArtifact({ change, html: change.rewrittenHtml, appliedChanges: change.appliedChanges, externalLinkChanges: change.externalLinkChanges, decisions: change.linkDecisions })
  if (links.pending.length) return { status: "awaiting_link_review" as const, pendingLinks: links.pending }
  const after = change.after, metaTitle = String(after.metaTitle || "").trim(), metaDescription = String(after.metaDescription || "").trim(), focusKeyword = String(after.focusKeyword || "").trim()
  if (!metaTitle || !metaDescription || !focusKeyword) throw new Error("SEO draft is missing meta title, description, or focus keyword.")
  const now = new Date(), attemptId = `seo_attempt_${crypto.randomUUID()}`
  const existingSeo = parseBlogSeo(change.blog!), keywords = strings((existingSeo as unknown as JsonRecord).keywords)
  if (!keywords.some((item) => item.toLowerCase() === focusKeyword.toLowerCase())) keywords.unshift(focusKeyword)
  const nextSeo = { ...existingSeo, metaTitle, seoTitle: metaTitle, metaDescription, focusKeyword, keywords: keywords.slice(0, 10), ogTitle: metaTitle, ogDescription: metaDescription, twitterTitle: metaTitle, twitterDescription: metaDescription }
  const clean = removeGeneratedFaq(change.rewrittenHtml), nextContent = `${clean}\n\n${faqHtml(after.faq, pidChange)}`.trim()
  await prisma.tochukwuSeoPipelineAttempt.create({ data: { pidAttempt: attemptId, pidChange, stage: "apply", status: "started", detailsJson: JSON.stringify({ sourceContentHash: sourceHash }), startedAt: now, createdAt: now, updatedAt: now } })
  try {
    await prisma.$transaction([
      prisma.tochukwuBlogPost.update({ where: { pidBlog: change.pidBlog! }, data: { blogContent: nextContent, blogExt2: JSON.stringify(nextSeo), seoJson: JSON.stringify(nextSeo), updatedAt: now } }),
      prisma.tochukwuSeoContentChangeLog.update({ where: { pidChange }, data: { status: "applied", beforeJson: JSON.stringify({ ...change.before, blogContent: change.blogContent, blogExt2: change.blogExt2, capturedAt: now.toISOString() }), publishedAt: now, updatedAt: now } }),
      prisma.tochukwuSeoRewriteArtifact.update({ where: { pidChange }, data: { status: "applied", appliedAt: now, updatedAt: now } }),
      ...(change.pidOpportunity ? [prisma.tochukwuSeoOpportunity.update({ where: { pidOpportunity: change.pidOpportunity }, data: { status: "applied", updatedAt: now } })] : []),
      prisma.tochukwuSeoPipelineAttempt.update({ where: { pidAttempt: attemptId }, data: { status: "completed", detailsJson: JSON.stringify({ publishedAt: now.toISOString() }), completedAt: now, updatedAt: now } })
    ])
  } catch (error) {
    const message = error instanceof Error ? error.message : "Saving the SEO change failed."
    await prisma.$transaction([
      prisma.tochukwuSeoRewriteArtifact.update({ where: { pidChange }, data: { status: "apply_failed", errorCode: "apply_failed", errorMessage: truncate(message, 2000), updatedAt: new Date() } }),
      prisma.tochukwuSeoContentChangeLog.update({ where: { pidChange }, data: { status: "apply_failed", updatedAt: new Date() } }),
      prisma.tochukwuSeoPipelineAttempt.update({ where: { pidAttempt: attemptId }, data: { status: "failed", errorCode: "apply_failed", errorMessage: truncate(message, 2000), completedAt: new Date(), updatedAt: new Date() } })
    ]); throw error
  }
  return { status: "applied" as const, pendingLinks: [] as string[] }
}

export async function approveSeoRewriteLink(input: { pidChange: string; url: string; scope: LinkApprovalDecision; approvedBy: string }) {
  const url = normalizeLinkableUrl(input.url); if (!url) throw new Error("The selected link is not a valid Tochukwu site URL.")
  const change = await getSeoChangeReview(input.pidChange); if (!change) throw new Error("SEO draft was not found.")
  if (["rejected", "applied"].includes(change.status) || !change.pendingLinks.includes(url)) throw new Error("That link is no longer awaiting approval.")
  const decisions = { ...change.linkDecisions, [url]: input.scope }, now = new Date()
  await prisma.tochukwuSeoRewriteArtifact.update({ where: { pidChange: input.pidChange }, data: { decisionsJson: JSON.stringify(decisions), reviewedAt: now, updatedAt: now } })
  if (input.scope === "global") await prisma.tochukwuSeoLinkablePage.upsert({ where: { normalizedUrl: url }, create: { pidLink: `seo_link_${crypto.randomUUID()}`, url, normalizedUrl: url, label: url.split("/").filter(Boolean).pop()?.split("-").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ") || "Approved page", status: "active", source: "admin", approvedBy: input.approvedBy, approvedAt: now, createdAt: now, updatedAt: now }, update: { url, status: "active", source: "admin", approvedBy: input.approvedBy, approvedAt: now, updatedAt: now } })
  return prepareSeoRewrite(input.pidChange)
}

export async function discardSeoRewrite(pidChange: string) {
  const now = new Date()
  await prisma.$transaction([prisma.tochukwuSeoRewriteArtifact.update({ where: { pidChange }, data: { status: "discarded", updatedAt: now } }), prisma.tochukwuSeoContentChangeLog.update({ where: { pidChange }, data: { status: "draft", updatedAt: now } })])
}

export async function rejectSeoChangeReview(pidChange: string) {
  const change = await prisma.tochukwuSeoContentChangeLog.findUnique({ where: { pidChange }, select: { status: true } })
  if (!change) throw new Error("SEO draft was not found.")
  if (change.status === "applied") throw new Error("An applied SEO change cannot be rejected.")
  if (change.status === "rejected") return
  const now = new Date()
  await prisma.$transaction([prisma.tochukwuSeoContentChangeLog.update({ where: { pidChange }, data: { status: "rejected", updatedAt: now } }), prisma.tochukwuSeoRewriteArtifact.updateMany({ where: { pidChange, status: { not: "applied" } }, data: { status: "rejected", updatedAt: now } })])
}

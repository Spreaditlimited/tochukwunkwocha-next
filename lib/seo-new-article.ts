import crypto from "crypto"

import { assertCleanGeneratedBlogHtml, normalizeBlogContentForStorage } from "@/lib/blog-content-html"
import { upsertBlogPost } from "@/lib/blog"
import { prisma } from "@/lib/prisma"
import { attachNewContentOpportunity } from "@/lib/seo"
import { extractExternalUrls, normalizeExternalUrl } from "@/lib/seo/external-link-policy"
import { getSeoLinkCatalog, type SeoLinkCatalogItem } from "@/lib/seo/link-catalog"
import { findNewUnapprovedLinks } from "@/lib/seo/link-policy"
import { safeJsonParse, stripHtml } from "@/lib/utils"

export const SEO_NEW_ARTICLE_POLICY_VERSION = "2026-08-researched-new-article-v1"

type JsonRecord = Record<string, unknown>
type OpenAiResponsePayload = {
  id?: string
  status?: string
  model?: string
  output_text?: string
  output?: Array<{ content?: Array<{ text?: unknown }> }>
  error?: { message?: string }
  incomplete_details?: { reason?: string }
}

type GeneratedArticle = {
  title: string
  slug: string
  metaTitle: string
  metaDescription: string
  focusKeyword: string
  excerpt: string
  tags: string[]
  html: string
  researchSummary: string[]
  targetQuestions: string[]
  internalLinks: Array<{ label: string; url: string }>
  externalSources: Array<{ label: string; url: string }>
}

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`
}

function apiKey() {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error("Missing OPENAI_API_KEY.")
  return key
}

function ids(pidOpportunity: string) {
  const hash = crypto.createHash("sha256").update(pidOpportunity).digest("hex")
  return {
    pidChange: `seo_article_${hash.slice(0, 48)}`,
    pidArtifact: `seo_artifact_${hash.slice(0, 48)}`,
    pidBlog: `BLOGSEO${hash.slice(0, 48)}`
  }
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean)
    : []
}

function objects(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object")
    : []
}

function outputText(payload: OpenAiResponsePayload) {
  if (typeof payload.output_text === "string") return payload.output_text
  return payload.output
    ?.flatMap((item) => item.content || [])
    .map((item) => item.text)
    .filter((item): item is string => typeof item === "string")
    .join("") || ""
}

function extractJson(value: string) {
  const trimmed = value.trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("AI response did not include a JSON article.")
  return JSON.parse(trimmed.slice(start, end + 1)) as JsonRecord
}

const articleSchema = {
  type: "object",
  properties: {
    title: { type: "string", minLength: 20, maxLength: 120 },
    slug: { type: "string", minLength: 3, maxLength: 180 },
    metaTitle: { type: "string", minLength: 20, maxLength: 65 },
    metaDescription: { type: "string", minLength: 120, maxLength: 160 },
    focusKeyword: { type: "string", minLength: 2, maxLength: 120 },
    excerpt: { type: "string", minLength: 80, maxLength: 320 },
    tags: { type: "array", minItems: 3, maxItems: 8, items: { type: "string" } },
    html: { type: "string" },
    researchSummary: { type: "array", minItems: 4, maxItems: 10, items: { type: "string" } },
    targetQuestions: { type: "array", minItems: 3, maxItems: 10, items: { type: "string" } },
    internalLinks: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        properties: { label: { type: "string" }, url: { type: "string" } },
        required: ["label", "url"],
        additionalProperties: false
      }
    },
    externalSources: {
      type: "array",
      minItems: 2,
      maxItems: 12,
      items: {
        type: "object",
        properties: { label: { type: "string" }, url: { type: "string" } },
        required: ["label", "url"],
        additionalProperties: false
      }
    }
  },
  required: ["title", "slug", "metaTitle", "metaDescription", "focusKeyword", "excerpt", "tags", "html", "researchSummary", "targetQuestions", "internalLinks", "externalSources"],
  additionalProperties: false
}

type Opportunity = NonNullable<Awaited<ReturnType<typeof getOpportunity>>>

async function getOpportunity(pidOpportunity: string) {
  return prisma.tochukwuSeoOpportunity.findUnique({
    where: { pidOpportunity },
    include: { blog: { select: { pidBlog: true, blogSlug: true } } }
  })
}

function articlePrompt(opportunity: Opportunity, catalog: SeoLinkCatalogItem[]) {
  const queryCluster = safeJsonParse<unknown>(opportunity.queryCluster, [])
  return `Research and write a first-class, publication-ready SEO article draft for Tochukwu Tech and AI Academy.

This is a new article, not a rewrite. Use live web research before writing. Study the current search intent, recurring questions, gaps in ranking coverage, and authoritative primary sources. Do not copy competitors or describe your research process in the article.

Non-negotiable editorial rules:
- Write primarily for readers in Nigeria while making the explanations useful internationally. Add Nigerian context only where it materially helps.
- Satisfy the search intent completely with specific explanations, realistic examples, actionable steps, comparisons, cautions, and FAQs where appropriate.
- Treat the exact primary query below as the non-negotiable focus keyword. Use it naturally in the title, opening, metadata and a relevant heading when editorially sound; do not replace it with a broader phrase or stuff it unnaturally.
- Use the related query cluster as secondary keywords and supporting questions. Cover only related terms that serve the same search intent.
- Aim for 1,800–2,800 useful words. Depth must come from substance, not repetition or filler.
- Use an original, confident, practical teaching voice. Do not claim personal experience, clients, employment details, tests, or results that were not supplied.
- Use current web research for facts that may change. Prefer official and primary sources, then authoritative specialist sources.
- Never invent statistics, laws, prices, dates, policies, product features, quotes, citations, URLs, guarantees, or Nigerian programmes.
- Cite factual claims naturally with descriptive HTML links to the sources you actually found. Include at least two authoritative external sources.
- Use only the exact approved internal URLs below, woven into genuinely relevant sentences. Never invent a site route.
- Return clean semantic article-body HTML only in the html field: paragraphs, h2/h3 headings, lists, tables when useful, strong/emphasis and anchors. No h1, document wrapper, scripts, styles, classes, markdown, comments, filenames, assistant preamble, or tracking parameters.
- The article title lives outside the HTML body. Do not repeat it as the first heading.
- End with a useful next step and a contextual CTA aligned with the requested CTA; do not turn the article into a sales page.
- The meta title must be 65 characters or fewer. The meta description must be 120–160 characters and accurately promise the page content.
- The externalSources audit must list every external URL used in the HTML. The internalLinks audit must list every internal URL used in the HTML.
- Return only JSON matching the supplied schema.

Search Console opportunity:
- research date: ${new Date().toISOString().slice(0, 10)}
- primary query: ${opportunity.primaryQuery || ""}
- related query cluster: ${JSON.stringify(queryCluster)}
- current ranking page: ${opportunity.pageUrl}
- impressions: ${opportunity.impressions}
- clicks: ${opportunity.clicks}
- CTR: ${Number(opportunity.ctr || 0)}
- average position: ${Number(opportunity.position || 0)}
- recommendation: ${opportunity.recommendation || ""}
- CTA intent: ${opportunity.recommendedCta || "general"}
- data window: ${opportunity.sourceStartDate?.toISOString().slice(0, 10) || "unknown"} to ${opportunity.sourceEndDate?.toISOString().slice(0, 10) || "unknown"}

Approved internal-link catalog:
${catalog.map((item, index) => `${index + 1}. ${item.label}: ${item.url} — ${item.useWhen}`).join("\n")}`
}

async function startOpenAiArticle(opportunity: Opportunity, catalog: SeoLinkCatalogItem[], idempotencyKey: string) {
  const model = process.env.SEO_CONTENT_REWRITE_MODEL || "gpt-5.6-sol"
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey
    },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model,
      background: true,
      reasoning: { effort: "high" },
      tools: [{ type: "web_search" }],
      tool_choice: "required",
      max_tool_calls: 10,
      max_output_tokens: 50_000,
      input: [
        {
          role: "system",
          content: "You are the senior SEO research editor and long-form writer for Tochukwu Tech and AI Academy. Produce original, authoritative, Nigeria-aware articles grounded in current research, with accurate citations and clean semantic HTML."
        },
        { role: "user", content: articlePrompt(opportunity, catalog) }
      ],
      text: { format: { type: "json_schema", name: "tochukwu_researched_new_article", schema: articleSchema, strict: true } }
    })
  })
  if (!response.ok) throw new Error(`OpenAI article request failed: ${response.status} ${truncate(await response.text(), 300)}`)
  return response.json() as Promise<OpenAiResponsePayload>
}

async function retrieveOpenAiArticle(responseId: string) {
  const response = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok) throw new Error(`OpenAI article status check failed: ${response.status} ${truncate(await response.text(), 300)}`)
  return response.json() as Promise<OpenAiResponsePayload>
}

function parseArticle(payload: OpenAiResponsePayload, catalog: SeoLinkCatalogItem[], primaryQuery: string): GeneratedArticle & { wordCount: number; externalUrls: string[]; internalUrls: string[] } {
  if (payload.status !== "completed") throw new Error(`OpenAI article is not complete (status: ${payload.status || "unknown"}).`)
  const raw = extractJson(outputText(payload))
  const html = normalizeBlogContentForStorage(String(raw.html || ""))
  assertCleanGeneratedBlogHtml(html)
  if (/<h1\b/i.test(html)) throw new Error("Generated article repeats the page title as an H1.")

  const wordCount = stripHtml(html).split(/\s+/).filter(Boolean).length
  if (wordCount < 1_400) throw new Error(`Generated article is too short (${wordCount} words). At least 1,400 useful words are required.`)

  const links = findNewUnapprovedLinks({ originalHtml: "", rewrittenHtml: html, approvedUrls: catalog.map((item) => item.url) })
  if (links.pending.length) throw new Error(`Generated article used unapproved internal links: ${links.pending.join(", ")}`)
  if (links.discovered.length < 2) throw new Error("Generated article must include at least two relevant approved internal links.")

  const externalUrls = extractExternalUrls(html)
  if (externalUrls.length < 2) throw new Error("Generated article must cite at least two authoritative external sources.")
  const declaredExternal = new Set(objects(raw.externalSources).map((item) => normalizeExternalUrl(item.url)).filter((url): url is string => Boolean(url)))
  const missingExternalAudit = externalUrls.filter((url) => !declaredExternal.has(url))
  if (missingExternalAudit.length) throw new Error(`Generated article omitted cited sources from its audit: ${missingExternalAudit.join(", ")}`)

  const title = String(raw.title || "").trim()
  const metaTitle = String(raw.metaTitle || "").trim()
  const metaDescription = String(raw.metaDescription || "").trim()
  const focusKeyword = primaryQuery.trim()
  const excerpt = String(raw.excerpt || "").trim()
  if (!title || !focusKeyword) throw new Error("Generated article is missing its title or focus keyword.")
  if (metaTitle.length > 65) throw new Error("Generated meta title exceeds 65 characters.")
  if (metaDescription.length < 120 || metaDescription.length > 160) throw new Error("Generated meta description must be 120–160 characters.")

  return {
    title,
    slug: String(raw.slug || title).trim(),
    metaTitle,
    metaDescription,
    focusKeyword,
    excerpt,
    tags: strings(raw.tags).slice(0, 8),
    html,
    researchSummary: strings(raw.researchSummary),
    targetQuestions: strings(raw.targetQuestions),
    internalLinks: objects(raw.internalLinks).map((item) => ({ label: String(item.label || "").trim(), url: String(item.url || "").trim() })).filter((item) => item.label && item.url),
    externalSources: objects(raw.externalSources).map((item) => ({ label: String(item.label || "").trim(), url: String(item.url || "").trim() })).filter((item) => item.label && item.url),
    wordCount,
    externalUrls,
    internalUrls: links.discovered
  }
}

async function markFailed(pidOpportunity: string, message: string, openAiStatus = "failed") {
  const { pidChange } = ids(pidOpportunity)
  const now = new Date()
  await prisma.$transaction([
    prisma.tochukwuSeoRewriteArtifact.updateMany({
      where: { pidChange },
      data: { status: "failed", openAiResponseStatus: openAiStatus, errorCode: "new_article_generation_failed", errorMessage: truncate(message, 4000), updatedAt: now }
    }),
    prisma.tochukwuSeoContentChangeLog.updateMany({ where: { pidChange }, data: { status: "failed", updatedAt: now } }),
    prisma.tochukwuSeoPipelineAttempt.updateMany({
      where: { pidChange, stage: "new_article", status: "started" },
      data: { status: "failed", errorCode: "new_article_generation_failed", errorMessage: truncate(message, 4000), completedAt: now, updatedAt: now }
    })
  ])
}

async function claimGenerationAttempt(input: {
  opportunity: Opportunity
  existing: Awaited<ReturnType<typeof getSeoNewArticleState>>
  sourceHash: string
  pidAttempt: string
  now: Date
}) {
  const generatedIds = ids(input.opportunity.pidOpportunity)
  const createChange = {
    pidChange: generatedIds.pidChange,
    pidOpportunity: input.opportunity.pidOpportunity,
    changeType: "new_article",
    status: "writing",
    beforeJson: JSON.stringify({ primaryQuery: input.opportunity.primaryQuery, pageUrl: input.opportunity.pageUrl, queryCluster: safeJsonParse(input.opportunity.queryCluster, []) }),
    validationJson: JSON.stringify({ ok: false, stage: "researching" }),
    createdAt: input.now,
    updatedAt: input.now
  }
  const createArtifact = {
    pidArtifact: generatedIds.pidArtifact,
    pidChange: generatedIds.pidChange,
    sourceContentHash: input.sourceHash,
    status: "rewriting",
    openAiResponseStatus: "starting",
    openAiModel: process.env.SEO_CONTENT_REWRITE_MODEL || "gpt-5.6-sol",
    attemptCount: 1,
    createdAt: input.now,
    updatedAt: input.now
  }
  const createAttempt = {
    pidAttempt: input.pidAttempt,
    pidChange: generatedIds.pidChange,
    stage: "new_article",
    status: "started",
    detailsJson: JSON.stringify({ sourceHash: input.sourceHash, primaryQuery: input.opportunity.primaryQuery }),
    startedAt: input.now,
    createdAt: input.now,
    updatedAt: input.now
  }

  if (!input.existing.change) {
    try {
      await prisma.$transaction([
        prisma.tochukwuSeoContentChangeLog.create({ data: createChange }),
        prisma.tochukwuSeoRewriteArtifact.create({ data: createArtifact }),
        prisma.tochukwuSeoPipelineAttempt.create({ data: createAttempt })
      ])
      return true
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") return false
      throw error
    }
  }

  if (input.existing.change.status !== "failed" || input.existing.artifact?.status !== "failed") return false
  return prisma.$transaction(async (tx) => {
    const claim = await tx.tochukwuSeoContentChangeLog.updateMany({
      where: { pidChange: generatedIds.pidChange, status: "failed" },
      data: { pidBlog: null, status: "writing", afterJson: null, validationJson: JSON.stringify({ ok: false, stage: "researching" }), publishedAt: null, updatedAt: input.now }
    })
    if (claim.count !== 1) return false
    await tx.tochukwuSeoRewriteArtifact.update({
      where: { pidChange: generatedIds.pidChange },
      data: { sourceContentHash: input.sourceHash, rewrittenHtml: null, appliedChangesJson: null, discoveredLinksJson: null, pendingLinksJson: null, decisionsJson: null, externalLinkChangesJson: null, qualityPolicyVersion: null, openAiResponseId: null, openAiResponseStatus: "starting", openAiModel: process.env.SEO_CONTENT_REWRITE_MODEL || "gpt-5.6-sol", status: "rewriting", errorCode: null, errorMessage: null, generatedAt: null, reviewedAt: null, appliedAt: null, attemptCount: { increment: 1 }, updatedAt: input.now }
    })
    await tx.tochukwuSeoPipelineAttempt.create({ data: createAttempt })
    return true
  })
}

async function finalizeArticle(opportunity: Opportunity, payload: OpenAiResponsePayload, attemptId: string | null) {
  const catalog = await getSeoLinkCatalog()
  const article = parseArticle(payload, catalog, opportunity.primaryQuery || "")
  const generatedIds = ids(opportunity.pidOpportunity)
  const post = await upsertBlogPost({
    pidBlog: generatedIds.pidBlog,
    blogTitle: article.title,
    blogSlug: article.slug,
    blogContent: article.html,
    blogPublished: false,
    blogFeatured: false,
    excerpt: article.excerpt,
    tags: article.tags,
    seo: {
      metaTitle: article.metaTitle,
      seoTitle: article.metaTitle,
      metaDescription: article.metaDescription,
      focusKeyword: article.focusKeyword
    }
  })
  await attachNewContentOpportunity(opportunity.pidOpportunity, post)

  const now = new Date()
  const audit = {
    title: article.title,
    slug: post.blogSlug,
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
    focusKeyword: article.focusKeyword,
    excerpt: article.excerpt,
    tags: article.tags,
    researchSummary: article.researchSummary,
    targetQuestions: article.targetQuestions,
    internalLinks: article.internalLinks,
    externalSources: article.externalSources
  }
  await prisma.$transaction([
    prisma.tochukwuSeoContentChangeLog.update({
      where: { pidChange: generatedIds.pidChange },
      data: { pidBlog: post.pidBlog, status: "article_draft_ready", afterJson: JSON.stringify(audit), validationJson: JSON.stringify({ ok: true, policyVersion: SEO_NEW_ARTICLE_POLICY_VERSION, wordCount: article.wordCount, internalUrls: article.internalUrls, externalUrls: article.externalUrls }), updatedAt: now }
    }),
    prisma.tochukwuSeoRewriteArtifact.update({
      where: { pidChange: generatedIds.pidChange },
      data: { rewrittenHtml: article.html, appliedChangesJson: JSON.stringify(article.researchSummary), discoveredLinksJson: JSON.stringify(article.internalUrls), pendingLinksJson: "[]", externalLinkChangesJson: JSON.stringify(article.externalSources), qualityPolicyVersion: SEO_NEW_ARTICLE_POLICY_VERSION, openAiResponseStatus: "completed", openAiModel: payload.model || process.env.SEO_CONTENT_REWRITE_MODEL || "gpt-5.6-sol", status: "ready", errorCode: null, errorMessage: null, generatedAt: now, reviewedAt: now, updatedAt: now }
    }),
    ...(attemptId ? [prisma.tochukwuSeoPipelineAttempt.update({ where: { pidAttempt: attemptId }, data: { status: "completed", detailsJson: JSON.stringify({ pidBlog: post.pidBlog, blogSlug: post.blogSlug, wordCount: article.wordCount, policyVersion: SEO_NEW_ARTICLE_POLICY_VERSION }), completedAt: now, updatedAt: now } })] : [])
  ])
  return { status: "ready" as const, ready: true, pidBlog: post.pidBlog, editUrl: `/internal/blog/${post.pidBlog}` }
}

export async function getSeoNewArticleState(pidOpportunity: string) {
  const generatedIds = ids(pidOpportunity)
  const [opportunity, change, artifact, attempt] = await Promise.all([
    getOpportunity(pidOpportunity),
    prisma.tochukwuSeoContentChangeLog.findUnique({ where: { pidChange: generatedIds.pidChange } }),
    prisma.tochukwuSeoRewriteArtifact.findUnique({ where: { pidChange: generatedIds.pidChange } }),
    prisma.tochukwuSeoPipelineAttempt.findFirst({ where: { pidChange: generatedIds.pidChange, stage: "new_article" }, orderBy: { createdAt: "desc" } })
  ])
  return { opportunity, change, artifact, attempt }
}

export async function prepareSeoNewArticle(pidOpportunity: string, options: { allowStart?: boolean } = {}) {
  const allowStart = options.allowStart !== false
  const opportunity = await getOpportunity(pidOpportunity)
  if (!opportunity) throw new Error("SEO opportunity was not found.")
  if (opportunity.opportunityType !== "new_content") throw new Error("This opportunity is not a new-article opportunity.")
  if (opportunity.blog) return { status: "ready" as const, ready: true, pidBlog: opportunity.blog.pidBlog, editUrl: `/internal/blog/${opportunity.blog.pidBlog}` }

  const generatedIds = ids(pidOpportunity)
  const existing = await getSeoNewArticleState(pidOpportunity)
  if (existing.artifact?.status === "rewriting" && existing.artifact.openAiResponseId) {
    const payload = await retrieveOpenAiArticle(existing.artifact.openAiResponseId)
    const openAiStatus = String(payload.status || "unknown")
    await prisma.tochukwuSeoRewriteArtifact.update({
      where: { pidChange: generatedIds.pidChange },
      data: { openAiResponseStatus: openAiStatus, openAiModel: payload.model || existing.artifact.openAiModel, updatedAt: new Date() }
    })
    if (["queued", "in_progress"].includes(openAiStatus)) return { status: "processing" as const, ready: false, openAiStatus }
    if (openAiStatus === "completed") {
      try {
        return await finalizeArticle(opportunity, payload, existing.attempt?.status === "started" ? existing.attempt.pidAttempt : null)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Generated article validation failed."
        await markFailed(pidOpportunity, message, openAiStatus)
        throw error
      }
    }
    const message = payload.error?.message || payload.incomplete_details?.reason || `OpenAI article generation ended with status ${openAiStatus}.`
    await markFailed(pidOpportunity, message, openAiStatus)
    throw new Error(message)
  }

  if (existing.artifact?.status === "rewriting" && !existing.artifact.openAiResponseId) {
    return { status: "processing" as const, ready: false, openAiStatus: "starting" }
  }
  if (!allowStart) {
    return { status: existing.artifact?.status || existing.change?.status || "not_started", ready: false, openAiStatus: existing.artifact?.openAiResponseStatus || "not_started", message: existing.artifact?.errorMessage || undefined }
  }

  const catalog = await getSeoLinkCatalog()
  const sourceHash = crypto.createHash("sha256").update(JSON.stringify({ pidOpportunity, primaryQuery: opportunity.primaryQuery, queryCluster: opportunity.queryCluster, recommendation: opportunity.recommendation, catalog })).digest("hex")
  const now = new Date()
  const pidAttempt = `seo_attempt_${crypto.randomUUID()}`
  const claimed = await claimGenerationAttempt({ opportunity, existing, sourceHash, pidAttempt, now })
  if (!claimed) return { status: "processing" as const, ready: false, openAiStatus: "starting" }

  try {
    const payload = await startOpenAiArticle(opportunity, catalog, `${generatedIds.pidChange}:${pidAttempt}`)
    if (!payload.id) throw new Error("OpenAI did not return a checkpointed response ID.")
    await prisma.tochukwuSeoRewriteArtifact.update({
      where: { pidChange: generatedIds.pidChange },
      data: { openAiResponseId: payload.id, openAiResponseStatus: payload.status || "queued", openAiModel: payload.model || process.env.SEO_CONTENT_REWRITE_MODEL || "gpt-5.6-sol", updatedAt: new Date() }
    })
    if (payload.status === "completed") return finalizeArticle(opportunity, payload, pidAttempt)
    return { status: "processing" as const, ready: false, openAiStatus: payload.status || "queued" }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start article generation."
    await markFailed(pidOpportunity, message)
    throw error
  }
}

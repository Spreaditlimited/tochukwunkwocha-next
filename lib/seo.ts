import crypto from "crypto"

import { prisma } from "@/lib/prisma"
import { parseBlogSeo } from "@/lib/blog"
import { safeJsonParse, stripHtml } from "@/lib/utils"

type SeoDraft = {
  changeType: "meta_refresh" | "content_refresh" | "faq_addition"
  metaTitle: string
  metaDescription: string
  focusKeyword: string
  faq: Array<{ question: string; answer: string }>
  internalLinks: Array<{ label: string; url: string; reason: string }>
  contentBrief: string[]
  ctaIntent: string
  riskNotes: string[]
  publishSafety: { safeForAutoPublish: boolean; reason: string }
}

const RULES_VERSION = "2026-07-09"

const internalLinkCatalog = [
  {
    label: "Prompt to Profit",
    url: "/courses/prompt-to-profit",
    useWhen: "Readers want to turn practical AI skills into useful outputs, services, or income opportunities."
  },
  {
    label: "AI Business Plan Service",
    url: "/services/business-plan",
    useWhen: "Readers need help turning a business idea into a clearer plan, offer, or launch path."
  },
  {
    label: "AI for Schools",
    url: "/schools",
    useWhen: "Parents, principals, teachers, or school owners are evaluating AI education for children or classrooms."
  },
  {
    label: "Private AI Build Coaching",
    url: "/private-ai-build-coaching",
    useWhen: "Readers need one-on-one help building a project, workflow, or AI-assisted product."
  },
  {
    label: "Blog",
    url: "/blog",
    useWhen: "Readers need more practical guides before choosing a course or service."
  }
]

const approvedUrls = new Set(internalLinkCatalog.map((item) => item.url))

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 3)}...`
}

function extractJsonObject(value: string) {
  const trimmed = value.trim()
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) throw new Error("AI response did not include a JSON object.")
  return trimmed.slice(start, end + 1)
}

function validateDraft(draft: Partial<SeoDraft>) {
  const errors: string[] = []
  const warnings: string[] = []

  if (!draft.metaTitle) errors.push("Meta title is required.")
  if (draft.metaTitle && draft.metaTitle.length > 65) errors.push("Meta title must be 65 characters or fewer.")
  if (!draft.metaDescription) errors.push("Meta description is required.")
  if (draft.metaDescription && (draft.metaDescription.length < 110 || draft.metaDescription.length > 165)) {
    warnings.push("Meta description is outside the preferred 110 to 165 character range.")
  }
  if (!draft.focusKeyword) errors.push("Focus keyword is required.")
  if (!draft.changeType || !["meta_refresh", "content_refresh", "faq_addition"].includes(draft.changeType)) {
    errors.push("Change type must be meta_refresh, content_refresh, or faq_addition.")
  }
  if (!Array.isArray(draft.faq) || draft.faq.length < 3) warnings.push("FAQ has fewer than 3 items.")
  if (Array.isArray(draft.internalLinks)) {
    draft.internalLinks.forEach((link, index) => {
      if (!approvedUrls.has(link.url)) errors.push(`Internal link ${index + 1} uses an unapproved URL.`)
    })
  }

  return { ok: errors.length === 0, errors, warnings, autoPublishAllowed: false, rulesVersion: RULES_VERSION }
}

function buildDraftPrompt(context: {
  blogTitle: string
  blogContent: string | null
  currentSeo: Record<string, unknown>
  opportunityType: string
  primaryQuery: string | null
  clicks: number
  impressions: number
  ctr: unknown
  position: unknown
  recommendation: string | null
  recommendedCta: string | null
}) {
  return `
You are the Tochukwu Tech and AI Academy SEO operations assistant. Create a conservative, reviewable SEO draft for an existing article.

Rules:
- Keep the audience practical: Nigerian students, parents, teachers, school owners, professionals, teams, and small business owners learning useful AI skills.
- Do not invent laws, prices, dates, scholarships, platform policies, statistics, guarantees, or tool capabilities.
- Preserve the author's direct, practical teaching voice.
- Internal links must use only URLs from the approved catalog.
- Never mark generated changes as ready for automatic publishing.

Approved internal link catalog:
${internalLinkCatalog.map((item, index) => `${index + 1}. ${item.label}: ${item.url} - ${item.useWhen}`).join("\n")}

Return only valid JSON:
{
  "changeType": "meta_refresh | content_refresh | faq_addition",
  "metaTitle": "string, max 65 characters",
  "metaDescription": "string, 110 to 165 characters",
  "focusKeyword": "string",
  "faq": [{"question":"string","answer":"string"}],
  "internalLinks": [{"label":"string","url":"exact approved URL","reason":"string"}],
  "contentBrief": ["short editorial instruction"],
  "ctaIntent": "string",
  "riskNotes": ["string"],
  "publishSafety": {"safeForAutoPublish": false, "reason": "string"}
}

Opportunity:
- type: ${context.opportunityType}
- query: ${context.primaryQuery || "unknown"}
- clicks: ${context.clicks}
- impressions: ${context.impressions}
- CTR: ${Number(context.ctr || 0)}
- position: ${Number(context.position || 0)}
- recommendation: ${context.recommendation || ""}
- recommended CTA: ${context.recommendedCta || ""}

Current SEO:
${JSON.stringify(context.currentSeo, null, 2)}

Article:
- title: ${context.blogTitle}
- body excerpt: ${truncate(stripHtml(context.blogContent), 6500)}
`.trim()
}

async function callOpenAiForDraft(prompt: string): Promise<SeoDraft> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY.")

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.SEO_AUTOMATION_MODEL || process.env.OPENAI_MODEL || "gpt-5",
      input: [
        {
          role: "system",
          content: "Return conservative JSON SEO drafts for Tochukwu Tech and AI Academy. Do not invent unsupported facts."
        },
        { role: "user", content: prompt }
      ]
    })
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OpenAI draft request failed: ${response.status} ${truncate(body, 240)}`)
  }

  const payload = await response.json() as {
    output_text?: unknown
    output?: Array<{ content?: Array<{ text?: unknown }> }>
  }
  const content =
    typeof payload?.output_text === "string"
      ? payload.output_text
      : payload?.output
          ?.flatMap((item) => item.content || [])
          ?.map((item) => item.text)
          ?.filter((item: unknown): item is string => typeof item === "string")
          ?.join("")

  if (typeof content !== "string") throw new Error("OpenAI response did not include draft text.")
  return JSON.parse(extractJsonObject(content))
}

function buildFaqHtml(faq: unknown, pidChange: string) {
  const items = Array.isArray(faq)
    ? faq
        .map((item) => ({
          question: typeof item?.question === "string" ? item.question.trim() : "",
          answer: typeof item?.answer === "string" ? item.answer.trim() : ""
        }))
        .filter((item) => item.question && item.answer)
    : []

  if (!items.length) return ""

  return `
<!-- tochukwu-seo-faq:start:${pidChange} -->
<section class="tochukwu-seo-faq" data-seo-change="${pidChange}">
  <h2>Frequently Asked Questions</h2>
  ${items.map((item) => `<h3>${item.question}</h3><p>${item.answer}</p>`).join("\n")}
</section>
<!-- tochukwu-seo-faq:end -->
`.trim()
}

function removeGeneratedFaq(content: string | null | undefined) {
  return String(content || "")
    .replace(/<!-- tochukwu-seo-faq:start:[\s\S]*?<!-- tochukwu-seo-faq:end -->/g, "")
    .trim()
}

export async function listSeoOpportunities(status = "open") {
  return prisma.tochukwuSeoOpportunity.findMany({
    where: status === "all" ? undefined : { status },
    include: {
      blog: { select: { blogTitle: true, blogSlug: true } },
      changes: { orderBy: { createdAt: "desc" }, take: 1 }
    },
    orderBy: [{ confidence: "desc" }, { impressions: "desc" }, { createdAt: "desc" }],
    take: 100
  })
}

export async function getSeoStats() {
  const [open, reviewing, dismissed, importedRows, latestRun] = await Promise.all([
    prisma.tochukwuSeoOpportunity.count({ where: { status: "open" } }),
    prisma.tochukwuSeoOpportunity.count({ where: { status: "reviewing" } }),
    prisma.tochukwuSeoOpportunity.count({ where: { status: "dismissed" } }),
    prisma.tochukwuSearchConsoleQueryStat.count(),
    prisma.tochukwuSearchConsoleImportRun.findFirst({
      where: { status: "completed" },
      orderBy: { completedAt: "desc" }
    })
  ])
  return {
    open,
    reviewing,
    dismissed,
    importedRows,
    latestImportAt: latestRun?.completedAt || null,
    latestImportSource: latestRun?.source || null,
    latestImportRows: latestRun?.rowCount || 0,
    latestImportStartDate: latestRun?.sourceStartDate || null,
    latestImportEndDate: latestRun?.sourceEndDate || null
  }
}

export async function generateSeoDraftForOpportunity(pidOpportunity: string) {
  const opportunity = await prisma.tochukwuSeoOpportunity.findUnique({
    where: { pidOpportunity },
    include: { blog: true }
  })
  if (!opportunity) throw new Error("SEO opportunity was not found.")
  if (!opportunity.blog) throw new Error("SEO opportunity is not matched to a blog post.")

  const currentSeo = parseBlogSeo(opportunity.blog) as Record<string, unknown>
  const draft = await callOpenAiForDraft(
    buildDraftPrompt({
      blogTitle: opportunity.blog.blogTitle,
      blogContent: opportunity.blog.blogContent,
      currentSeo,
      opportunityType: opportunity.opportunityType,
      primaryQuery: opportunity.primaryQuery,
      clicks: opportunity.clicks,
      impressions: opportunity.impressions,
      ctr: opportunity.ctr,
      position: opportunity.position,
      recommendation: opportunity.recommendation,
      recommendedCta: opportunity.recommendedCta
    })
  )
  const validation = validateDraft(draft)
  const pidChange = `seo_change_${crypto.randomUUID()}`
  const now = new Date()

  await prisma.$transaction([
    prisma.tochukwuSeoContentChangeLog.create({
      data: {
        pidChange,
        pidOpportunity: opportunity.pidOpportunity,
        pidBlog: opportunity.blog.pidBlog,
        changeType: draft.changeType || "seo_draft",
        status: "draft",
        beforeJson: JSON.stringify({
          blogTitle: opportunity.blog.blogTitle,
          blogSlug: opportunity.blog.blogSlug,
          pageUrl: opportunity.pageUrl,
          seoData: currentSeo
        }),
        afterJson: JSON.stringify(draft),
        validationJson: JSON.stringify(validation),
        createdAt: now,
        updatedAt: now
      }
    }),
    prisma.tochukwuSeoOpportunity.update({
      where: { pidOpportunity: opportunity.pidOpportunity },
      data: { status: "reviewing", updatedAt: now }
    })
  ])

  return { pidChange, validation }
}

export async function getSeoChange(pidChange: string) {
  const change = await prisma.tochukwuSeoContentChangeLog.findUnique({
    where: { pidChange },
    include: { blog: true, opportunity: true }
  })
  if (!change) return null
  return {
    ...change,
    before: safeJsonParse<Record<string, unknown>>(change.beforeJson, {}),
    after: safeJsonParse<Record<string, unknown>>(change.afterJson, {}),
    validation: safeJsonParse<Record<string, unknown>>(change.validationJson, {})
  }
}

export async function applySeoChange(pidChange: string) {
  const change = await getSeoChange(pidChange)
  if (!change?.blog) throw new Error("SEO change was not found.")
  if (change.status === "applied" || change.status === "rejected") throw new Error("This change is already closed.")

  const after = change.after as Partial<SeoDraft>
  const metaTitle = String(after.metaTitle || "").trim()
  const metaDescription = String(after.metaDescription || "").trim()
  const focusKeyword = String(after.focusKeyword || "").trim()
  if (!metaTitle || !metaDescription || !focusKeyword) throw new Error("Draft is missing required SEO fields.")

  const existingSeo = parseBlogSeo(change.blog)
  const nextSeo = {
    ...existingSeo,
    metaTitle,
    seoTitle: metaTitle,
    metaDescription,
    focusKeyword
  }
  const faqHtml = buildFaqHtml(after.faq, change.pidChange)
  const cleanContent = removeGeneratedFaq(change.blog.blogContent)
  const nextContent = faqHtml ? `${cleanContent}\n\n${faqHtml}` : cleanContent
  const now = new Date()

  await prisma.$transaction([
    prisma.tochukwuBlogPost.update({
      where: { pidBlog: change.blog.pidBlog },
      data: {
        blogContent: nextContent,
        blogExt2: JSON.stringify(nextSeo),
        seoJson: JSON.stringify(nextSeo),
        updatedAt: now
      }
    }),
    prisma.tochukwuSeoContentChangeLog.update({
      where: { pidChange },
      data: { status: "applied", publishedAt: now, updatedAt: now }
    }),
    ...(change.pidOpportunity
      ? [
          prisma.tochukwuSeoOpportunity.update({
            where: { pidOpportunity: change.pidOpportunity },
            data: { status: "applied", updatedAt: now }
          })
        ]
      : [])
  ])

  return change.blog.blogSlug
}

export async function rejectSeoChange(pidChange: string) {
  const now = new Date()
  await prisma.tochukwuSeoContentChangeLog.update({
    where: { pidChange },
    data: { status: "rejected", updatedAt: now }
  })
}

export async function updateOpportunityStatus(pidOpportunity: string, status: string) {
  if (!["open", "reviewing", "dismissed", "applied"].includes(status)) return
  await prisma.tochukwuSeoOpportunity.update({
    where: { pidOpportunity },
    data: { status, updatedAt: new Date() }
  })
}

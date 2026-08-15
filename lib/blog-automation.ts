import crypto from "crypto"
import fs from "node:fs"
import path from "node:path"
import { Prisma } from "@prisma/client"
import PDFDocument from "pdfkit"

import { prisma } from "@/lib/prisma"
import { getBlogImageSrc } from "@/lib/blog"
import { addColumnIfMissing } from "@/lib/schema-guards"
import { safeJsonParse, slugify, stripHtml } from "@/lib/utils"

type BlogPostForAutomation = {
  pidBlog: string
  blogTitle: string
  blogSlug: string
  blogContent: string | null
  blogImage: string | null
  excerpt: string | null
  tagsJson: string | null
}

type LeadMagnetDraft = {
  leadMagnetTitle: string
  offerHeadline: string
  description: string
  buttonText: string
  bullets: string[]
  emailSubject: string
  deliveryMessage: string
  pdf: {
    title: string
    subtitle: string
    audience: string
    promise: string
    sections: Array<{ heading: string; items: string[] }>
    actionPlan: string[]
    closingNote: string
    serviceCta: {
      label: string
      headline: string
      body: string
      url: string
    }
  }
}

const DEFAULT_BREVO_LIST_ID = 17
const BLOG_IMAGE_FOLDER = "tochukwu/blog"
export type BlogAutomationJobType = "image" | "leadMagnet" | "leadMagnetLayout"
type ProgressReporter = (stage: string, progress: number) => Promise<void>
let blogAutomationJobsReady: Promise<void> | null = null

function clean(value: unknown, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

function truncate(value: unknown, max = 1000) {
  const text = clean(value, max + 120)
  if (text.length <= max) return text
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}...`
}

function safeJsonStringify(value: unknown) {
  return JSON.stringify(value ?? null)
}

function normalizeBullets(value: unknown, limit = 8, max = 180) {
  if (!Array.isArray(value)) return []
  return value.map((item) => clean(item, max)).filter(Boolean).slice(0, limit)
}

function parseTags(post: BlogPostForAutomation) {
  const tags = safeJsonParse<unknown>(post.tagsJson, [])
  return Array.isArray(tags) ? tags.map((tag) => clean(tag, 80)).filter(Boolean) : []
}

function getOpenAiApiKey() {
  const apiKey = clean(process.env.OPENAI_API_KEY, 500)
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY.")
  return apiKey
}

export async function ensureBlogLeadMagnetTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_blog_lead_magnet_files (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      magnet_uuid VARCHAR(80) NOT NULL,
      pid_blog VARCHAR(64) NOT NULL,
      filename VARCHAR(255) NULL,
      content_type VARCHAR(120) NOT NULL DEFAULT 'application/pdf',
      byte_size INT UNSIGNED NOT NULL DEFAULT 0,
      file_data LONGBLOB NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_blog_lead_file_magnet (magnet_uuid),
      KEY idx_blog_lead_file_pid (pid_blog)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await addColumnIfMissing("tochukwu_blog_lead_magnets", "pdf_filename", "VARCHAR(255) NULL")
  await addColumnIfMissing("tochukwu_blog_lead_magnets", "pdf_resource_type", "VARCHAR(40) NULL")
  await addColumnIfMissing("tochukwu_blog_lead_magnets", "delivery_message", "TEXT NULL")
  await addColumnIfMissing("tochukwu_blog_lead_magnets", "draft_json", "LONGTEXT NULL")
}

export async function ensureBlogImageJobsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_blog_image_jobs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      job_uuid VARCHAR(72) NOT NULL,
      pid_blog VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'queued',
      error_message TEXT NULL,
      prompt LONGTEXT NULL,
      image_public_id VARCHAR(500) NULL,
      image_url TEXT NULL,
      build_hook_json TEXT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      finished_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_blog_image_job_uuid (job_uuid),
      KEY idx_blog_image_job_pid_created (pid_blog, created_at),
      KEY idx_blog_image_job_status_created (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

export async function ensureBlogAutomationJobsTable() {
  if (!blogAutomationJobsReady) blogAutomationJobsReady = prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_blog_automation_jobs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      job_uuid VARCHAR(80) NOT NULL,
      pid_blog VARCHAR(64) NOT NULL,
      job_type VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'queued',
      stage VARCHAR(255) NOT NULL DEFAULT 'Queued',
      progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
      error_message TEXT NULL,
      result_json LONGTEXT NULL,
      started_at DATETIME NULL,
      finished_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_blog_automation_job_uuid (job_uuid),
      KEY idx_blog_automation_pid_type_created (pid_blog, job_type, created_at),
      KEY idx_blog_automation_status_updated (status, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).then(() => undefined).catch((error) => { blogAutomationJobsReady = null; throw error })
  await blogAutomationJobsReady
}

type AutomationJobRow = {
  jobUuid: string; pidBlog: string; jobType: BlogAutomationJobType; status: string; stage: string
  progress: number | bigint; errorMessage: string | null; resultJson: string | null
  startedAt: Date | null; finishedAt: Date | null; createdAt: Date; updatedAt: Date
}

function automationJobPayload(row: AutomationJobRow | undefined) {
  if (!row) return null
  return { ...row, progress: Number(row.progress || 0), result: safeJsonParse(row.resultJson, null), ready: ["succeeded", "failed"].includes(row.status) }
}

export async function getBlogAutomationJob(input: { pidBlog: string; type: BlogAutomationJobType; jobUuid?: string }) {
  await ensureBlogAutomationJobsTable()
  const rows = await prisma.$queryRaw<AutomationJobRow[]>`
    SELECT job_uuid AS jobUuid, pid_blog AS pidBlog, job_type AS jobType, status, stage, progress,
      error_message AS errorMessage, result_json AS resultJson, started_at AS startedAt,
      finished_at AS finishedAt, created_at AS createdAt, updated_at AS updatedAt
    FROM tochukwu_blog_automation_jobs
    WHERE pid_blog = ${clean(input.pidBlog, 64)} AND job_type = ${input.type}
      ${input.jobUuid ? Prisma.sql`AND job_uuid = ${clean(input.jobUuid, 80)}` : Prisma.empty}
    ORDER BY created_at DESC LIMIT 1
  `
  return automationJobPayload(rows[0])
}

export async function startBlogAutomationJob(pidBlog: string, type: BlogAutomationJobType) {
  await ensureBlogAutomationJobsTable()
  const post = await getPost(pidBlog)
  const staleBefore = new Date(Date.now() - 20 * 60 * 1000)
  await prisma.$executeRaw`UPDATE tochukwu_blog_automation_jobs SET status='failed', stage='Generation timed out', error_message='The job stopped before completion.', progress=100, finished_at=${new Date()}, updated_at=${new Date()} WHERE pid_blog=${post.pidBlog} AND job_type=${type} AND status IN ('queued','running') AND updated_at < ${staleBefore}`
  const active = await getBlogAutomationJob({ pidBlog: post.pidBlog, type })
  if (active && ["queued", "running"].includes(active.status)) return { ...active, alreadyRunning: true }
  const jobUuid = `BAUTO${crypto.randomBytes(12).toString("hex")}`, now = new Date()
  await prisma.$executeRaw`INSERT INTO tochukwu_blog_automation_jobs (job_uuid,pid_blog,job_type,status,stage,progress,created_at,updated_at) VALUES (${jobUuid},${post.pidBlog},${type},'queued','Request checkpointed',5,${now},${now})`
  return { ...(await getBlogAutomationJob({ pidBlog: post.pidBlog, type, jobUuid }))!, alreadyRunning: false }
}

async function reportBlogAutomationProgress(jobUuid: string, stage: string, progress: number) {
  await prisma.$executeRaw`UPDATE tochukwu_blog_automation_jobs SET status='running', stage=${clean(stage, 255)}, progress=${Math.max(0, Math.min(99, Math.round(progress)))}, started_at=COALESCE(started_at,${new Date()}), updated_at=${new Date()} WHERE job_uuid=${jobUuid} AND status IN ('queued','running')`
}

export async function executeBlogAutomationJob(jobUuid: string) {
  await ensureBlogAutomationJobsTable()
  const rows = await prisma.$queryRaw<AutomationJobRow[]>`SELECT job_uuid AS jobUuid, pid_blog AS pidBlog, job_type AS jobType, status, stage, progress, error_message AS errorMessage, result_json AS resultJson, started_at AS startedAt, finished_at AS finishedAt, created_at AS createdAt, updated_at AS updatedAt FROM tochukwu_blog_automation_jobs WHERE job_uuid=${clean(jobUuid, 80)} LIMIT 1`
  const job = rows[0]
  if (!job || !["queued", "running"].includes(job.status)) return automationJobPayload(job)
  const report: ProgressReporter = (stage, progress) => reportBlogAutomationProgress(job.jobUuid, stage, progress)
  try {
    await report("Loading article context", 10)
    const result = job.jobType === "image"
      ? await generateBlogImageForPost(job.pidBlog, report)
      : job.jobType === "leadMagnetLayout"
        ? await rebuildLeadMagnetPdfForPost(job.pidBlog, report)
        : await generateLeadMagnetForPost(job.pidBlog, report)
    const now = new Date()
    const resultJson = JSON.stringify(result, (_key, value) => typeof value === "bigint" ? value.toString() : value)
    const completedStage = job.jobType === "image"
      ? "Image generated and saved"
      : job.jobType === "leadMagnetLayout"
        ? "PDF design rebuilt without an OpenAI call"
        : "PDF lead magnet generated and activated"
    await prisma.$executeRaw`UPDATE tochukwu_blog_automation_jobs SET status='succeeded', stage=${completedStage}, progress=100, result_json=${resultJson}, error_message=NULL, finished_at=${now}, updated_at=${now} WHERE job_uuid=${job.jobUuid}`
  } catch (error) {
    const now = new Date(), message = error instanceof Error ? error.message : "Blog automation failed."
    await prisma.$executeRaw`UPDATE tochukwu_blog_automation_jobs SET status='failed', stage='Generation failed', progress=100, error_message=${message}, finished_at=${now}, updated_at=${now} WHERE job_uuid=${job.jobUuid}`
  }
  return getBlogAutomationJob({ pidBlog: job.pidBlog, type: job.jobType, jobUuid: job.jobUuid })
}

async function getPost(pidBlog: string) {
  const post = await prisma.tochukwuBlogPost.findUnique({
    where: { pidBlog },
    select: {
      pidBlog: true,
      blogTitle: true,
      blogSlug: true,
      blogContent: true,
      blogImage: true,
      excerpt: true,
      tagsJson: true
    }
  })
  if (!post) throw new Error("Blog post not found.")
  return post
}

function leadMagnetPrompt(post: BlogPostForAutomation) {
  return [
    "Create a premium blog PDF lead magnet for Tochukwu Tech and AI Academy.",
    "The audience is practical AI learners, parents, schools, students, professionals, teams, and business owners.",
    "The finished PDF is exactly two A4 pages. Prioritise useful, specific content over introductions, filler, motivational language, or repeated ideas.",
    "Create exactly 3 sections with exactly 3 concrete, self-contained recommendations in each section, plus exactly 4 action steps.",
    "Every recommendation must give the reader a decision, method, warning, example, or next action they can use immediately.",
    "Return only valid JSON.",
    "Do not include markdown.",
    "",
    "Required JSON shape:",
    "{",
    '  "leadMagnetTitle": "max 95 chars",',
    '  "offerHeadline": "max 120 chars",',
    '  "description": "max 190 chars",',
    '  "buttonText": "max 36 chars",',
    '  "bullets": ["short benefit bullets"],',
    '  "emailSubject": "max 80 chars",',
    '  "deliveryMessage": "max 280 chars",',
    '  "pdf": {',
    '    "title": "max 90 chars",',
    '    "subtitle": "max 140 chars",',
    '    "audience": "max 75 chars",',
    '    "promise": "max 120 chars",',
    '    "sections": [{ "heading": "max 45 chars", "items": ["exactly 3 concrete recommendations, max 90 chars each"] }],',
    '    "actionPlan": ["exactly 4 specific steps, max 85 chars each"],',
    '    "closingNote": "max 130 chars",',
    '    "serviceCta": { "label": "max 28 chars", "headline": "max 62 chars", "body": "max 110 chars", "url": "/courses/prompt-to-profit/ or /courses/prompt-to-profit-schools/ or /courses/ai-for-everyday-business-owners/ or /build/ or /contact/" }',
    "  }",
    "}",
    "",
    `Blog title: ${post.blogTitle}`,
    `Blog slug: ${post.blogSlug}`,
    post.excerpt ? `Excerpt: ${post.excerpt}` : "",
    parseTags(post).length ? `Tags: ${parseTags(post).join(", ")}` : "",
    `Article content: ${truncate(stripHtml(post.blogContent), 4200)}`
  ].filter(Boolean).join("\n")
}

async function callOpenAiJson(prompt: string): Promise<LeadMagnetDraft> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAiApiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_LEAD_MAGNET_MODEL || process.env.OPENAI_MODEL || "gpt-4.1",
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You write precise JSON for high-converting educational lead magnets." },
        { role: "user", content: prompt }
      ]
    })
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI lead magnet request failed (${response.status}).`)
  const content = payload?.choices?.[0]?.message?.content
  if (!content) throw new Error("OpenAI returned no lead magnet content.")
  return JSON.parse(content)
}

function normalizeLeadMagnetDraft(raw: LeadMagnetDraft) {
  const pdf = raw.pdf || {}
  return {
    leadMagnetTitle: clean(raw.leadMagnetTitle, 95),
    offerHeadline: clean(raw.offerHeadline, 120),
    description: clean(raw.description, 190),
    buttonText: clean(raw.buttonText, 36),
    bullets: normalizeBullets(raw.bullets, 5, 110),
    emailSubject: clean(raw.emailSubject, 80),
    deliveryMessage: clean(raw.deliveryMessage, 280),
    pdf: {
      title: clean(pdf.title, 90),
      subtitle: clean(pdf.subtitle, 140),
      audience: clean(pdf.audience, 75),
      promise: clean(pdf.promise, 120),
      sections: Array.isArray(pdf.sections)
        ? pdf.sections.map((section) => ({
            heading: clean(section?.heading, 45),
            items: normalizeBullets(section?.items, 3, 90)
          })).filter((section) => section.heading && section.items.length).slice(0, 3)
        : [],
      actionPlan: normalizeBullets(pdf.actionPlan, 4, 85),
      closingNote: clean(pdf.closingNote, 130),
      serviceCta: {
        label: clean(pdf.serviceCta?.label, 28),
        headline: clean(pdf.serviceCta?.headline, 62),
        body: clean(pdf.serviceCta?.body, 110),
        url: clean(pdf.serviceCta?.url, 180)
      }
    }
  }
}

function hasCompleteTwoPageContent(item: ReturnType<typeof normalizeLeadMagnetDraft>) {
  return Boolean(
    item.leadMagnetTitle &&
    item.pdf.title &&
    item.pdf.sections.length === 3 &&
    item.pdf.sections.every((section) => section.items.length === 3) &&
    item.pdf.actionPlan.length === 4
  )
}

async function createDesignedPdfBuffer(item: ReturnType<typeof normalizeLeadMagnetDraft>, post: BlogPostForAutomation) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    bufferPages: true,
    info: {
      Title: item.pdf.title,
      Author: "Tochukwu Nkwocha",
      Subject: item.pdf.subtitle,
      Keywords: parseTags(post).join(", "),
      Creator: "Tochukwu Tech and AI Academy"
    }
  })
  const chunks: Buffer[] = []
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  const width = doc.page.width
  const height = doc.page.height
  const navy = "#071A33"
  const blue = "#0D4F9A"
  const cyan = "#BDEBFA"
  const pale = "#F3F8FC"
  const ink = "#122238"
  const muted = "#52657A"
  const white = "#FFFFFF"
  const logoLight = path.join(process.cwd(), "public/brand/tochukwu-tech-logo-reverse.png")
  const logoDark = path.join(process.cwd(), "public/brand/tochukwu-tech-logo.png")

  function brandLogo(variant: "light" | "dark", x: number, y: number, logoWidth = 210) {
    const file = variant === "light" ? logoLight : logoDark
    if (fs.existsSync(file)) {
      doc.image(file, x, y, { width: logoWidth })
      return
    }
    doc.font("Helvetica-Bold").fontSize(13).fillColor(variant === "light" ? white : blue)
      .text("TOCHUKWU TECH & AI ACADEMY", x, y, { width: logoWidth })
  }

  function pageChrome(pageNumber: number, label = "PRACTICAL AI GUIDE") {
    doc.rect(0, 0, width, height).fill(pale)
    doc.rect(0, 0, 14, height).fill(blue)
    doc.rect(14, 0, 5, height).fill(cyan)
    brandLogo("dark", 48, 35, 184)
    doc.font("Helvetica-Bold").fontSize(8).fillColor(blue).text(label, 350, 44, {
      width: 197,
      height: 12,
      align: "right",
      characterSpacing: 1.2
    })
    doc.moveTo(48, 78).lineTo(547, 78).lineWidth(1).strokeColor("#D8E5EF").stroke()
    doc.font("Helvetica").fontSize(8).fillColor(muted)
      .text("tochukwunkwocha.com", 48, 807, { width: 240, height: 12 })
      .text(String(pageNumber).padStart(2, "0"), 500, 807, { width: 47, height: 12, align: "right" })
  }

  // Page 1: compact cover and useful overview.
  doc.rect(0, 0, width, height).fill(navy)
  doc.circle(520, 90, 170).fill("#0B315D")
  doc.circle(540, 50, 100).fill("#0D4F9A")
  doc.rect(0, 0, 18, height).fill(cyan)
  brandLogo("light", 56, 48, 235)
  doc.roundedRect(56, 125, 151, 25, 12).fill(cyan)
  doc.font("Helvetica-Bold").fontSize(8).fillColor(navy).text("2-PAGE PRACTICAL GUIDE", 66, 134, {
    width: 131,
    height: 12,
    align: "center",
    characterSpacing: 0.9
  })
  doc.font("Helvetica-Bold").fontSize(27).fillColor(white).text(item.pdf.title, 56, 181, {
    width: 475,
    height: 120,
    lineGap: 5
  })
  doc.font("Helvetica").fontSize(13).fillColor(cyan).text(item.pdf.subtitle, 56, 315, {
    width: 455,
    height: 58,
    lineGap: 5
  })
  const coverCardY = 390
  doc.roundedRect(56, coverCardY, 475, 124, 16).fill("#102C4C")
  doc.font("Helvetica-Bold").fontSize(8).fillColor(cyan).text("FOR", 78, coverCardY + 20, {
    height: 12,
    characterSpacing: 1.2
  })
  doc.font("Helvetica").fontSize(10).fillColor(white).text(item.pdf.audience, 78, coverCardY + 38, {
    width: 425,
    height: 28,
    lineGap: 3
  })
  doc.font("Helvetica-Bold").fontSize(8).fillColor(cyan).text("OUTCOME", 78, coverCardY + 72, {
    height: 12,
    characterSpacing: 1.2
  })
  doc.font("Helvetica-Bold").fontSize(10).fillColor(white).text(item.pdf.promise, 78, coverCardY + 90, {
    width: 425,
    height: 28,
    lineGap: 3
  })
  const overviewY = coverCardY + 154
  doc.font("Helvetica-Bold").fontSize(9).fillColor(cyan).text("AT A GLANCE", 56, overviewY, { height: 12, characterSpacing: 1.1 })
  let overviewCardY = overviewY + 25
  item.pdf.sections.forEach((section, index) => {
    doc.roundedRect(56, overviewCardY, 475, 68, 12).fill("#102C4C")
    doc.roundedRect(72, overviewCardY + 14, 38, 38, 9).fill(blue)
    doc.font("Helvetica-Bold").fontSize(12).fillColor(white).text(String(index + 1).padStart(2, "0"), 72, overviewCardY + 26, {
      width: 38,
      height: 15,
      align: "center"
    })
    doc.font("Helvetica-Bold").fontSize(11).fillColor(white).text(section.heading, 126, overviewCardY + 13, { width: 382, height: 16 })
    doc.font("Helvetica").fontSize(8.5).fillColor("#C7D7E6").text(section.items[0], 126, overviewCardY + 34, {
      width: 382,
      height: 25,
      lineGap: 2
    })
    overviewCardY += 78
  })
  doc.font("Helvetica").fontSize(8).fillColor("#AFC5DA").text("BY TOCHUKWU NKWOCHA", 56, 817, {
    height: 11,
    characterSpacing: 1.2
  })

  // Page 2: all recommendations, action plan and CTA.
  doc.addPage()
  pageChrome(2, "PRACTICAL PLAYBOOK")
  doc.font("Helvetica-Bold").fontSize(23).fillColor(ink).text("Use this now", 48, 102, { width: 499, height: 29 })
  let sectionY = 145
  item.pdf.sections.forEach((section, index) => {
    const cardHeight = 118
    doc.roundedRect(48, sectionY, 499, cardHeight, 11).fill(white)
    doc.circle(70, sectionY + 23, 12).fill(blue)
    doc.font("Helvetica-Bold").fontSize(9).fillColor(white).text(String(index + 1), 64, sectionY + 20, {
      width: 12,
      height: 12,
      align: "center"
    })
    doc.font("Helvetica-Bold").fontSize(12).fillColor(ink).text(section.heading, 92, sectionY + 15, { width: 430, height: 17 })
    let itemY = sectionY + 42
    section.items.forEach((text) => {
      doc.circle(70, itemY + 5, 2.3).fill(cyan)
      doc.font("Helvetica").fontSize(9.25).fillColor(muted).text(text, 82, itemY, {
        width: 440,
        height: 21,
        lineGap: 2
      })
      itemY += 24
    })
    sectionY += cardHeight + 10
  })

  const actionY = sectionY + 5
  doc.font("Helvetica-Bold").fontSize(13).fillColor(ink).text("4-step action plan", 48, actionY, { width: 499, height: 18 })
  item.pdf.actionPlan.forEach((step, index) => {
    const column = index % 2
    const row = Math.floor(index / 2)
    const x = 48 + column * 254
    const y = actionY + 27 + row * 55
    doc.roundedRect(x, y, 245, 47, 9).fill("#E7F2FA")
    doc.roundedRect(x + 9, y + 9, 29, 29, 7).fill(blue)
    doc.font("Helvetica-Bold").fontSize(10).fillColor(white).text(String(index + 1), x + 9, y + 19, {
      width: 29,
      height: 12,
      align: "center"
    })
    doc.font("Helvetica").fontSize(8.2).fillColor(ink).text(step, x + 46, y + 9, {
      width: 187,
      height: 31,
      lineGap: 1
    })
  })

  const ctaUrl = item.pdf.serviceCta.url.startsWith("http")
    ? item.pdf.serviceCta.url
    : `https://www.tochukwunkwocha.com${item.pdf.serviceCta.url.startsWith("/") ? "" : "/"}${item.pdf.serviceCta.url}`
  const ctaY = actionY + 143
  doc.roundedRect(48, ctaY, 499, 74, 12).fill(blue)
  doc.font("Helvetica-Bold").fontSize(11).fillColor(white).text(item.pdf.serviceCta.headline, 66, ctaY + 14, {
    width: 300,
    height: 16
  })
  doc.font("Helvetica").fontSize(8.2).fillColor("#DCEAF5").text(item.pdf.serviceCta.body, 66, ctaY + 34, {
    width: 300,
    height: 28,
    lineGap: 2
  })
  doc.roundedRect(384, ctaY + 17, 145, 40, 9).fill(cyan)
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(navy).text("CONTINUE ONLINE", 394, ctaY + 32, {
    width: 125,
    height: 12,
    align: "center",
    link: ctaUrl
  })

  const renderedPageCount = doc.bufferedPageRange().count
  doc.end()
  const buffer = await completed
  if (renderedPageCount !== 2) {
    throw new Error(`Lead magnet renderer produced ${renderedPageCount} pages; expected exactly 2.`)
  }
  return buffer
}

async function makeUniqueLeadMagnetSlug(title: string, currentUuid?: string) {
  const base = slugify(title) || `lead-magnet-${Date.now()}`
  let candidate = base
  let index = 2
  while (true) {
    const existing = await prisma.tochukwuBlogLeadMagnet.findUnique({
      where: { slug: candidate },
      select: { magnetUuid: true }
    }).catch(() => null)
    if (!existing || existing.magnetUuid === currentUuid) return candidate
    candidate = `${base}-${index}`
    index += 1
  }
}

export async function generateLeadMagnetForPost(pidBlog: string, report?: ProgressReporter) {
  await ensureBlogLeadMagnetTables()
  const post = await getPost(pidBlog)
  await report?.("Generating lead magnet copy with OpenAI", 25)
  const generated = normalizeLeadMagnetDraft(await callOpenAiJson(leadMagnetPrompt(post)))
  if (!hasCompleteTwoPageContent(generated)) {
    throw new Error("OpenAI returned an incomplete lead magnet draft.")
  }

  const existing = await prisma.tochukwuBlogLeadMagnet.findUnique({ where: { pidBlog: post.pidBlog } }).catch(() => null)
  const magnetUuid = existing?.magnetUuid || `BLM${crypto.randomBytes(12).toString("hex")}`
  const slug = await makeUniqueLeadMagnetSlug(generated.leadMagnetTitle, magnetUuid)
  const filename = `${slug}.pdf`
  const pdfUrl = `/api/blog/lead-magnet/download?slug=${encodeURIComponent(slug)}`
  const now = new Date()

  await report?.("Saving lead capture copy and delivery settings", 60)

  const leadMagnet = await prisma.tochukwuBlogLeadMagnet.upsert({
    where: { pidBlog: post.pidBlog },
    create: {
      magnetUuid,
      pidBlog: post.pidBlog,
      slug,
      status: "active",
      title: generated.leadMagnetTitle,
      offerHeadline: generated.offerHeadline,
      description: generated.description,
      buttonText: generated.buttonText || "Send me the PDF",
      bulletsJson: safeJsonStringify(generated.bullets),
      pdfUrl,
      pdfPublicId: "",
      pdfResourceType: "raw",
      pdfFilename: filename,
      brevoListId: BigInt(DEFAULT_BREVO_LIST_ID),
      emailSubject: generated.emailSubject,
      deliveryMessage: generated.deliveryMessage,
      createdAt: now,
      updatedAt: now
    },
    update: {
      slug,
      status: "active",
      title: generated.leadMagnetTitle,
      offerHeadline: generated.offerHeadline,
      description: generated.description,
      buttonText: generated.buttonText || "Send me the PDF",
      bulletsJson: safeJsonStringify(generated.bullets),
      pdfUrl,
      pdfPublicId: "",
      pdfResourceType: "raw",
      pdfFilename: filename,
      brevoListId: existing?.brevoListId || BigInt(DEFAULT_BREVO_LIST_ID),
      emailSubject: generated.emailSubject,
      deliveryMessage: generated.deliveryMessage,
      updatedAt: now
    }
  })

  // Preserve the approved copy separately from the binary PDF so future
  // visual rebuilds do not need another OpenAI request.
  await prisma.$executeRaw`
    UPDATE tochukwu_blog_lead_magnets
    SET draft_json = ${safeJsonStringify(generated)}, updated_at = ${now}
    WHERE magnet_uuid = ${magnetUuid}
  `

  await report?.("Applying the branded two-page PDF design", 78)
  const pdf = await createDesignedPdfBuffer(generated, post)
  await report?.("Saving and activating the PDF offer", 90)
  await prisma.$executeRaw`
    INSERT INTO tochukwu_blog_lead_magnet_files
      (magnet_uuid, pid_blog, filename, content_type, byte_size, file_data, created_at, updated_at)
    VALUES
      (${magnetUuid}, ${post.pidBlog}, ${filename}, ${"application/pdf"}, ${pdf.length}, ${pdf}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      pid_blog = VALUES(pid_blog),
      filename = VALUES(filename),
      content_type = VALUES(content_type),
      byte_size = VALUES(byte_size),
      file_data = VALUES(file_data),
      updated_at = VALUES(updated_at)
  `

  return leadMagnet
}

export async function rebuildLeadMagnetPdfForPost(pidBlog: string, report?: ProgressReporter) {
  await ensureBlogLeadMagnetTables()
  const post = await getPost(pidBlog)
  await report?.("Loading the saved lead magnet copy — no OpenAI call", 30)
  const rows = await prisma.$queryRaw<Array<{
    magnetUuid: string
    filename: string | null
    draftJson: string | null
  }>>`
    SELECT magnet_uuid AS magnetUuid, pdf_filename AS filename, draft_json AS draftJson
    FROM tochukwu_blog_lead_magnets
    WHERE pid_blog = ${post.pidBlog}
    LIMIT 1
  `
  const source = safeJsonParse<LeadMagnetDraft | null>(rows[0]?.draftJson, null)
  if (!rows[0] || !source) {
    throw new Error("No saved lead magnet source exists yet. Regenerate the copy once; later design rebuilds will not call OpenAI.")
  }
  const generated = normalizeLeadMagnetDraft(source)
  if (!hasCompleteTwoPageContent(generated)) {
    throw new Error("The saved lead magnet source does not satisfy the two-page content contract. Regenerate the copy once to upgrade it.")
  }

  await report?.("Rebuilding the fixed two-page PDF layout", 65)
  const pdf = await createDesignedPdfBuffer(generated, post)
  const now = new Date()
  const filename = clean(rows[0].filename, 255) || `${slugify(generated.leadMagnetTitle) || "lead-magnet"}.pdf`
  await report?.("Replacing the PDF file without regenerating copy", 90)
  await prisma.$executeRaw`
    INSERT INTO tochukwu_blog_lead_magnet_files
      (magnet_uuid, pid_blog, filename, content_type, byte_size, file_data, created_at, updated_at)
    VALUES
      (${rows[0].magnetUuid}, ${post.pidBlog}, ${filename}, ${"application/pdf"}, ${pdf.length}, ${pdf}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      filename = VALUES(filename), content_type = VALUES(content_type), byte_size = VALUES(byte_size),
      file_data = VALUES(file_data), updated_at = VALUES(updated_at)
  `
  return { magnetUuid: rows[0].magnetUuid, filename, byteSize: pdf.length, openAiCalled: false, pageCount: 2 }
}

function blogImagePrompt(post: BlogPostForAutomation) {
  return [
    "Create a modern, pristine editorial hero image for a blog post.",
    "The image must fit a premium practical AI education and business website.",
    "",
    `Blog title: ${post.blogTitle}`,
    post.excerpt ? `Excerpt: ${post.excerpt}` : "",
    parseTags(post).length ? `Tags: ${parseTags(post).join(", ")}` : "",
    `Article context: ${truncate(stripHtml(post.blogContent), 1000)}`,
    "",
    "Style requirements:",
    "- 16:9 landscape composition.",
    "- strong central subject, clear depth, balanced negative space.",
    "- abstract, symbolic, product, workspace, technology, dashboard, classroom, business, productivity, strategy, data, or digital-building metaphor.",
    "- no visible text, no letters, no numbers, no logos, no watermarks.",
    "- no human beings, no faces, no portraits, no silhouettes, no hands, no body parts."
  ].join("\n")
}

async function generateOpenAiImage(prompt: string) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAiApiKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      prompt,
      size: process.env.OPENAI_IMAGE_SIZE || "1536x1024",
      quality: process.env.OPENAI_IMAGE_QUALITY || "high",
      n: 1
    })
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI image request failed (${response.status}).`)
  const first = payload?.data?.[0]
  if (first?.b64_json) return Buffer.from(first.b64_json, "base64")
  if (first?.url) {
    const imageResponse = await fetch(first.url)
    if (!imageResponse.ok) throw new Error(`Could not download generated image (${imageResponse.status}).`)
    return Buffer.from(await imageResponse.arrayBuffer())
  }
  throw new Error("OpenAI image response was empty.")
}

function cloudinarySignature(params: Record<string, string | number>) {
  const secret = clean(process.env.CLOUDINARY_API_SECRET, 500)
  if (!secret) throw new Error("Missing CLOUDINARY_API_SECRET.")
  const base = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&")
  return crypto.createHash("sha1").update(`${base}${secret}`).digest("hex")
}

async function uploadGeneratedBlogImage(buffer: Buffer, publicId: string) {
  const cloudName = clean(process.env.CLOUDINARY_CLOUD_NAME, 120)
  const apiKey = clean(process.env.CLOUDINARY_API_KEY, 220)
  if (!cloudName) throw new Error("Missing CLOUDINARY_CLOUD_NAME.")
  if (!apiKey) throw new Error("Missing CLOUDINARY_API_KEY.")

  const timestamp = Math.floor(Date.now() / 1000)
  const params = {
    folder: BLOG_IMAGE_FOLDER,
    public_id: publicId,
    timestamp,
    overwrite: "true"
  }
  const form = new FormData()
  form.set("file", new Blob([new Uint8Array(buffer)], { type: "image/png" }), `${publicId}.png`)
  form.set("api_key", apiKey)
  form.set("folder", params.folder)
  form.set("public_id", params.public_id)
  form.set("timestamp", String(params.timestamp))
  form.set("overwrite", params.overwrite)
  form.set("signature", cloudinarySignature(params))

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
    method: "POST",
    body: form
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error?.message || `Cloudinary upload failed (${response.status}).`)
  return {
    publicId: clean(payload.public_id, 500),
    secureUrl: clean(payload.secure_url, 1000)
  }
}

export async function generateBlogImageForPost(pidBlog: string, report?: ProgressReporter) {
  await ensureBlogImageJobsTable()
  const post = await getPost(pidBlog)
  const jobUuid = `BIMG${crypto.randomBytes(12).toString("hex")}`
  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO tochukwu_blog_image_jobs
      (job_uuid, pid_blog, status, created_at, updated_at)
    VALUES
      (${jobUuid}, ${post.pidBlog}, ${"running"}, ${now}, ${now})
  `

  try {
    const prompt = blogImagePrompt(post)
    await report?.("Preparing the image brief", 20)
    await prisma.$executeRaw`
      UPDATE tochukwu_blog_image_jobs SET prompt = ${prompt}, updated_at = ${new Date()} WHERE job_uuid = ${jobUuid}
    `
    await report?.("Generating the cover image with OpenAI", 35)
    const image = await generateOpenAiImage(prompt)
    const publicId = `BLOG_${crypto.randomBytes(10).toString("hex")}`
    await report?.("Uploading the generated image to Cloudinary", 72)
    const uploaded = await uploadGeneratedBlogImage(image, publicId)
    await report?.("Saving the image to the blog post", 92)
    await prisma.tochukwuBlogPost.update({
      where: { pidBlog: post.pidBlog },
      data: {
        blogImage: uploaded.publicId,
        updatedAt: new Date()
      }
    })
    await prisma.$executeRaw`
      UPDATE tochukwu_blog_image_jobs
      SET status = 'succeeded',
          image_public_id = ${uploaded.publicId},
          image_url = ${getBlogImageSrc(uploaded.publicId) || uploaded.secureUrl},
          updated_at = ${new Date()},
          finished_at = ${new Date()}
      WHERE job_uuid = ${jobUuid}
    `
    return { jobUuid, imagePublicId: uploaded.publicId, imageUrl: getBlogImageSrc(uploaded.publicId) || uploaded.secureUrl }
  } catch (error) {
    await prisma.$executeRaw`
      UPDATE tochukwu_blog_image_jobs
      SET status = 'failed',
          error_message = ${error instanceof Error ? error.message : "Could not generate blog image."},
          updated_at = ${new Date()},
          finished_at = ${new Date()}
      WHERE job_uuid = ${jobUuid}
    `
    throw error
  }
}

export async function getLeadMagnetFileBySlug(slug: string) {
  await ensureBlogLeadMagnetTables()
  const rows = await prisma.$queryRaw<Array<{
    title: string | null
    filename: string | null
    contentType: string | null
    byteSize: number | bigint | null
    fileData: Buffer
  }>>`
    SELECT m.title, f.filename, f.content_type AS contentType, f.byte_size AS byteSize, f.file_data AS fileData
    FROM tochukwu_blog_lead_magnets m
    INNER JOIN tochukwu_blog_lead_magnet_files f ON f.magnet_uuid = m.magnet_uuid
    WHERE m.slug = ${clean(slug, 255)} AND m.status = 'active'
    LIMIT 1
  `
  const row = rows[0]
  if (!row) return null
  return {
    title: clean(row.title, 255),
    filename: clean(row.filename, 255) || `${clean(slug, 120) || "lead-magnet"}.pdf`,
    contentType: clean(row.contentType, 120) || "application/pdf",
    byteSize: Number(row.byteSize || 0),
    buffer: Buffer.isBuffer(row.fileData) ? row.fileData : Buffer.from(row.fileData || "")
  }
}

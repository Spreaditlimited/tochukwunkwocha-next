import crypto from "crypto"

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
    '    "sections": [{ "heading": "max 55 chars", "items": ["max 90 chars each"] }],',
    '    "actionPlan": ["max 85 chars each"],',
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
            heading: clean(section?.heading, 55),
            items: normalizeBullets(section?.items, 5, 90)
          })).filter((section) => section.heading && section.items.length).slice(0, 4)
        : [],
      actionPlan: normalizeBullets(pdf.actionPlan, 5, 85),
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

function escapePdfText(value: unknown) {
  return clean(value, 4000).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

function wrapText(value: unknown, maxChars = 88) {
  const words = clean(value, 3000).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

function createSimplePdfBuffer(item: ReturnType<typeof normalizeLeadMagnetDraft>, post: BlogPostForAutomation) {
  const lines: Array<{ text: string; size: number; gap: number }> = [
    { text: "Tochukwu Tech and AI Academy", size: 11, gap: 20 },
    { text: item.pdf.title, size: 22, gap: 26 },
    { text: item.pdf.subtitle, size: 12, gap: 28 },
    { text: `For: ${item.pdf.audience}`, size: 11, gap: 18 },
    { text: item.pdf.promise, size: 11, gap: 24 }
  ]

  for (const section of item.pdf.sections) {
    lines.push({ text: section.heading, size: 15, gap: 20 })
    for (const bullet of section.items) lines.push({ text: `- ${bullet}`, size: 10, gap: 14 })
    lines.push({ text: "", size: 10, gap: 10 })
  }

  if (item.pdf.actionPlan.length) {
    lines.push({ text: "Action plan", size: 15, gap: 20 })
    for (const step of item.pdf.actionPlan) lines.push({ text: `- ${step}`, size: 10, gap: 14 })
  }

  lines.push({ text: item.pdf.closingNote, size: 11, gap: 22 })
  lines.push({ text: item.pdf.serviceCta.headline, size: 15, gap: 20 })
  lines.push({ text: `${item.pdf.serviceCta.body} ${item.pdf.serviceCta.url}`, size: 10, gap: 16 })
  lines.push({ text: `Companion guide for: ${post.blogTitle}`, size: 8, gap: 12 })

  const content: string[] = ["BT", "/F1 10 Tf", "50 792 Td"]
  let y = 792
  for (const line of lines) {
    const wrapped = line.text ? wrapText(line.text, line.size >= 15 ? 50 : 88) : [""]
    for (const part of wrapped) {
      if (y < 72) break
      content.push(`/F1 ${line.size} Tf`)
      content.push(`(${escapePdfText(part)}) Tj`)
      content.push(`0 -${line.gap} Td`)
      y -= line.gap
    }
  }
  content.push("ET")

  const stream = content.join("\n")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ]

  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return Buffer.from(pdf)
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

export async function generateLeadMagnetForPost(pidBlog: string) {
  await ensureBlogLeadMagnetTables()
  const post = await getPost(pidBlog)
  const generated = normalizeLeadMagnetDraft(await callOpenAiJson(leadMagnetPrompt(post)))
  if (!generated.leadMagnetTitle || !generated.pdf.title || !generated.pdf.sections.length) {
    throw new Error("OpenAI returned an incomplete lead magnet draft.")
  }

  const existing = await prisma.tochukwuBlogLeadMagnet.findUnique({ where: { pidBlog: post.pidBlog } }).catch(() => null)
  const magnetUuid = existing?.magnetUuid || `BLM${crypto.randomBytes(12).toString("hex")}`
  const slug = await makeUniqueLeadMagnetSlug(generated.leadMagnetTitle, magnetUuid)
  const filename = `${slug}.pdf`
  const pdfUrl = `/api/blog/lead-magnet/download?slug=${encodeURIComponent(slug)}`
  const now = new Date()

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

  const pdf = createSimplePdfBuffer(generated, post)
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

export async function generateBlogImageForPost(pidBlog: string) {
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
    await prisma.$executeRaw`
      UPDATE tochukwu_blog_image_jobs SET prompt = ${prompt}, updated_at = ${new Date()} WHERE job_uuid = ${jobUuid}
    `
    const image = await generateOpenAiImage(prompt)
    const publicId = `BLOG_${crypto.randomBytes(10).toString("hex")}`
    const uploaded = await uploadGeneratedBlogImage(image, publicId)
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

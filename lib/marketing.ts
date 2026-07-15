import crypto from "crypto"

import { sendEmail } from "@/lib/email"
import { sendMetaLeadEvent } from "@/lib/meta-events"
import { prisma } from "@/lib/prisma"
import { addColumnIfMissing } from "@/lib/schema-guards"

const DEFAULT_BREVO_LIST_ID = 17
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type MarketingDashboard = {
  days: number
  summary: {
    totalLeads: number
    periodLeads: number
    uniqueEmails: number
    convertingPages: number
  }
  recentLeads: MarketingLeadRow[]
  sources: MarketingChartRow[]
  pages: MarketingChartRow[]
  campaigns: MarketingChartRow[]
  daily: MarketingChartRow[]
}

export type MarketingLeadRow = {
  id: number
  leadUuid: string
  firstName: string
  email: string
  listId: number
  source: string
  pageType: string
  pageUrl: string
  pathname: string
  referrer: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
  utmContent: string
  utmTerm: string
  fbclid: string
  fbp: string
  fbc: string
  leadTrack: string
  blogPid: string
  blogSlug: string
  leadMagnetSlug: string
  leadMagnetTitle: string
  pdfUrl: string
  createdAt: Date | null
  updatedAt: Date | null
}

export type MarketingChartRow = {
  label: string
  leads: number
}

function clean(value: unknown, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

function normalizeEmail(value: unknown) {
  return clean(value, 190).toLowerCase()
}

function toInt(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.round(numberValue) : fallback
}

function siteBaseUrl() {
  return clean(process.env.SITE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://tochukwunkwocha.com", 240).replace(/\/+$/, "")
}

function absoluteUrl(value: unknown) {
  const raw = clean(value, 2000)
  if (!raw) return ""
  const normalized = normalizeLeadMagnetDownloadUrl(raw)
  if (normalized !== raw) return absoluteUrl(normalized)
  if (/^https?:\/\//i.test(raw)) return raw
  return `${siteBaseUrl()}${raw.startsWith("/") ? raw : `/${raw}`}`
}

export function normalizeLeadMagnetDownloadUrl(value: unknown) {
  const raw = clean(value, 2000)
  if (!raw) return ""
  try {
    const parsed = new URL(raw, siteBaseUrl())
    if (parsed.pathname === "/.netlify/functions/blog-lead-magnet-download") {
      const slug = parsed.searchParams.get("slug") || ""
      const version = parsed.searchParams.get("v") || ""
      const params = new URLSearchParams()
      if (slug) params.set("slug", slug)
      if (version) params.set("v", version)
      return `/api/blog/lead-magnet/download?${params.toString()}`
    }
  } catch (_error) {}
  return raw
}

export async function ensureMarketingLeadsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_marketing_leads (
      id BIGINT NOT NULL AUTO_INCREMENT,
      lead_uuid VARCHAR(80) NOT NULL,
      first_name VARCHAR(120) NULL,
      email VARCHAR(190) NOT NULL,
      list_id BIGINT NULL,
      source VARCHAR(100) NULL,
      page_type VARCHAR(40) NULL,
      page_url TEXT NULL,
      pathname VARCHAR(500) NULL,
      referrer TEXT NULL,
      utm_source VARCHAR(190) NULL,
      utm_medium VARCHAR(190) NULL,
      utm_campaign VARCHAR(190) NULL,
      utm_content VARCHAR(190) NULL,
      utm_term VARCHAR(190) NULL,
      fbclid TEXT NULL,
      fbp VARCHAR(190) NULL,
      fbc VARCHAR(190) NULL,
      lead_track VARCHAR(120) NULL,
      blog_pid VARCHAR(64) NULL,
      blog_slug VARCHAR(255) NULL,
      lead_magnet_slug VARCHAR(255) NULL,
      lead_magnet_title VARCHAR(255) NULL,
      pdf_url TEXT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_marketing_lead_uuid (lead_uuid),
      KEY idx_marketing_leads_email (email),
      KEY idx_marketing_leads_created (created_at),
      KEY idx_marketing_leads_page_type (page_type),
      KEY idx_marketing_leads_pathname (pathname),
      KEY idx_marketing_leads_utm_source (utm_source),
      KEY idx_marketing_leads_utm_campaign (utm_campaign),
      KEY idx_marketing_leads_track (lead_track),
      KEY idx_marketing_leads_blog_slug (blog_slug),
      KEY idx_marketing_leads_magnet_slug (lead_magnet_slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await addColumnIfMissing("tochukwu_marketing_leads", "lead_track", "VARCHAR(120) NULL")
  await addColumnIfMissing("tochukwu_marketing_leads", "blog_pid", "VARCHAR(64) NULL")
  await addColumnIfMissing("tochukwu_marketing_leads", "blog_slug", "VARCHAR(255) NULL")
  await addColumnIfMissing("tochukwu_marketing_leads", "lead_magnet_slug", "VARCHAR(255) NULL")
  await addColumnIfMissing("tochukwu_marketing_leads", "lead_magnet_title", "VARCHAR(255) NULL")
  await addColumnIfMissing("tochukwu_marketing_leads", "pdf_url", "TEXT NULL")
}

export async function ensureBlogLeadCaptureTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_blog_lead_submissions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      submission_uuid VARCHAR(80) NOT NULL,
      magnet_uuid VARCHAR(80) NULL,
      pid_blog VARCHAR(64) NULL,
      first_name VARCHAR(120) NULL,
      email VARCHAR(190) NOT NULL,
      marketing_lead_uuid VARCHAR(80) NULL,
      list_id BIGINT NULL,
      source VARCHAR(100) NULL,
      page_type VARCHAR(40) NULL,
      page_url TEXT NULL,
      pathname VARCHAR(500) NULL,
      referrer TEXT NULL,
      utm_source VARCHAR(190) NULL,
      utm_medium VARCHAR(190) NULL,
      utm_campaign VARCHAR(190) NULL,
      utm_content VARCHAR(190) NULL,
      utm_term VARCHAR(190) NULL,
      fbclid TEXT NULL,
      fbp VARCHAR(190) NULL,
      fbc VARCHAR(190) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_blog_lead_submission_uuid (submission_uuid),
      KEY idx_blog_lead_submission_email (email),
      KEY idx_blog_lead_submission_magnet (magnet_uuid),
      KEY idx_blog_lead_submission_pid (pid_blog),
      KEY idx_blog_lead_submission_created (created_at),
      KEY idx_blog_lead_submission_utm_campaign (utm_campaign)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_blog_lead_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      event_uuid VARCHAR(80) NOT NULL,
      magnet_uuid VARCHAR(80) NULL,
      pid_blog VARCHAR(64) NULL,
      event_name VARCHAR(80) NOT NULL,
      page_url TEXT NULL,
      pathname VARCHAR(500) NULL,
      referrer TEXT NULL,
      utm_source VARCHAR(190) NULL,
      utm_medium VARCHAR(190) NULL,
      utm_campaign VARCHAR(190) NULL,
      utm_content VARCHAR(190) NULL,
      utm_term VARCHAR(190) NULL,
      fbclid TEXT NULL,
      fbp VARCHAR(190) NULL,
      fbc VARCHAR(190) NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_blog_lead_event_uuid (event_uuid),
      KEY idx_blog_lead_event_magnet_name (magnet_uuid, event_name),
      KEY idx_blog_lead_event_pid_name (pid_blog, event_name),
      KEY idx_blog_lead_event_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

async function createMarketingLead(input: {
  firstName: string
  email: string
  listId: number
  source: string
  pageType: string
  pageUrl: string
  pathname: string
  referrer: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
  utmContent: string
  utmTerm: string
  fbclid: string
  fbp: string
  fbc: string
  leadTrack: string
  blogPid: string
  blogSlug: string
  leadMagnetSlug: string
  leadMagnetTitle: string
  pdfUrl: string
}) {
  await ensureMarketingLeadsTable()
  const now = new Date()
  const leadUuid = crypto.randomUUID()
  await prisma.$executeRaw`
    INSERT INTO tochukwu_marketing_leads
      (lead_uuid, first_name, email, list_id, source, page_type, page_url, pathname, referrer,
       utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, fbp, fbc,
       lead_track, blog_pid, blog_slug, lead_magnet_slug, lead_magnet_title, pdf_url, created_at, updated_at)
    VALUES
      (${leadUuid}, ${clean(input.firstName, 120) || null}, ${normalizeEmail(input.email)}, ${input.listId || null},
       ${clean(input.source, 100) || "lead_capture_popup"}, ${clean(input.pageType, 40) || null},
       ${clean(input.pageUrl, 2000) || null}, ${clean(input.pathname, 500) || null}, ${clean(input.referrer, 2000) || null},
       ${clean(input.utmSource, 190) || null}, ${clean(input.utmMedium, 190) || null}, ${clean(input.utmCampaign, 190) || null},
       ${clean(input.utmContent, 190) || null}, ${clean(input.utmTerm, 190) || null}, ${clean(input.fbclid, 2000) || null},
       ${clean(input.fbp, 190) || null}, ${clean(input.fbc, 190) || null}, ${clean(input.leadTrack, 120) || null},
       ${clean(input.blogPid, 64) || null}, ${clean(input.blogSlug, 255) || null}, ${clean(input.leadMagnetSlug, 255) || null},
       ${clean(input.leadMagnetTitle, 255) || null}, ${clean(input.pdfUrl, 2000) || null}, ${now}, ${now})
  `
  return { leadUuid }
}

async function createBlogLeadSubmission(input: {
  magnetUuid: string
  pidBlog: string
  firstName: string
  email: string
  marketingLeadUuid: string
  listId: number
  source: string
  pageType: string
  pageUrl: string
  pathname: string
  referrer: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
  utmContent: string
  utmTerm: string
  fbclid: string
  fbp: string
  fbc: string
}) {
  await ensureBlogLeadCaptureTables()
  const now = new Date()
  const submissionUuid = `BLS${crypto.randomBytes(12).toString("hex")}`
  await prisma.$executeRaw`
    INSERT INTO tochukwu_blog_lead_submissions
      (submission_uuid, magnet_uuid, pid_blog, first_name, email, marketing_lead_uuid, list_id, source, page_type, page_url, pathname, referrer,
       utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, fbp, fbc, created_at, updated_at)
    VALUES
      (${submissionUuid}, ${clean(input.magnetUuid, 80) || null}, ${clean(input.pidBlog, 64) || null}, ${clean(input.firstName, 120) || null},
       ${normalizeEmail(input.email)}, ${clean(input.marketingLeadUuid, 80) || null}, ${input.listId || DEFAULT_BREVO_LIST_ID},
       ${clean(input.source, 100) || "blog_lead_magnet"}, ${clean(input.pageType, 40) || "blog"}, ${clean(input.pageUrl, 2000) || null},
       ${clean(input.pathname, 500) || null}, ${clean(input.referrer, 2000) || null}, ${clean(input.utmSource, 190) || null},
       ${clean(input.utmMedium, 190) || null}, ${clean(input.utmCampaign, 190) || null}, ${clean(input.utmContent, 190) || null},
       ${clean(input.utmTerm, 190) || null}, ${clean(input.fbclid, 2000) || null}, ${clean(input.fbp, 190) || null},
       ${clean(input.fbc, 190) || null}, ${now}, ${now})
  `
  return { submissionUuid }
}

export async function createBlogLeadEvent(body: Record<string, unknown>) {
  await ensureBlogLeadCaptureTables()
  const eventName = clean(body.eventName || body.event_name, 80)
  const leadMagnetSlug = clean(body.leadMagnetSlug || body.lead_magnet_slug, 255)
  if (!eventName || !leadMagnetSlug) throw new Error("eventName and leadMagnetSlug are required.")

  const leadMagnet = await prisma.tochukwuBlogLeadMagnet.findFirst({
    where: { slug: leadMagnetSlug, status: "active" }
  })
  if (!leadMagnet) throw new Error("Lead magnet not found.")

  const eventUuid = `BLE${crypto.randomBytes(12).toString("hex")}`
  await prisma.$executeRaw`
    INSERT INTO tochukwu_blog_lead_events
      (event_uuid, magnet_uuid, pid_blog, event_name, page_url, pathname, referrer,
       utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, fbp, fbc, created_at)
    VALUES
      (${eventUuid}, ${leadMagnet.magnetUuid}, ${leadMagnet.pidBlog}, ${eventName},
       ${clean(body.pageUrl || body.page_url, 2000) || null}, ${clean(body.pathname, 500) || null},
       ${clean(body.referrer, 2000) || null}, ${clean(body.utmSource || body.utm_source, 190) || null},
       ${clean(body.utmMedium || body.utm_medium, 190) || null}, ${clean(body.utmCampaign || body.utm_campaign, 190) || null},
       ${clean(body.utmContent || body.utm_content, 190) || null}, ${clean(body.utmTerm || body.utm_term, 190) || null},
       ${clean(body.fbclid, 2000) || null}, ${clean(body.fbp, 190) || null}, ${clean(body.fbc, 190) || null}, ${new Date()})
  `
  return { eventUuid }
}

async function syncBrevoSubscriber(input: {
  fullName: string
  email: string
  listId: number
  attributes: Record<string, string>
}) {
  const apiKey = clean(process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY, 1000)
  if (!apiKey) return { ok: true, skipped: true }
  const response = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({
      email: normalizeEmail(input.email),
      attributes: {
        FIRSTNAME: clean(input.fullName, 120),
        ...input.attributes
      },
      listIds: input.listId ? [input.listId] : undefined,
      updateEnabled: true
    })
  })
  if (!response.ok) {
    const text = await response.text().catch(() => "")
    return { ok: false, error: text || `Brevo contact sync failed (${response.status})` }
  }
  return { ok: true }
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function escapeHtml(value: unknown) {
  return clean(value, 4000)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function pageContextLabel(input: { pathname?: string; pageType?: string }) {
  const pathname = clean(input.pathname, 500).toLowerCase()
  const pageType = clean(input.pageType, 40).toLowerCase()
  if (pathname === "/" || pathname === "/index.html") return "the home page"
  if (pathname.startsWith("/courses/") || pathname.startsWith("/enrol-")) return "a course page"
  if (pathname.startsWith("/schools")) return "the schools page"
  if (pathname.startsWith("/build") || pathname.startsWith("/websites")) return "a build service page"
  if (pageType && pageType !== "site") return `${pageType.replace(/[_-]+/g, " ")} page`
  return "the website"
}

function welcomeEmail(input: { firstName: string; pageType: string; pathname: string }) {
  const firstName = clean(input.firstName, 120) || "there"
  const context = pageContextLabel(input)
  const blogUrl = `${siteBaseUrl()}/blog/`
  const coursesUrl = `${siteBaseUrl()}/courses/prompt-to-profit/`
  const contactUrl = `${siteBaseUrl()}/contact/`
  const body = [
    `<p>Hi ${escapeHtml(firstName)},</p>`,
    `<p>Thanks for joining from ${escapeHtml(context)}. You are now on my practical AI and building list.</p>`,
    `<p>Within the next 7 days, you should start receiving my weekly trainings. I use those notes to share clear, practical lessons on AI, digital skills, useful tools, and building real projects without unnecessary jargon.</p>`,
    `<p>Before then, you can read the latest practical guides or explore the course if you want a more structured learning path.</p>`,
    `<p><a href="${escapeHtml(blogUrl)}">Read the latest guides</a></p>`,
    `<p>If you are thinking about AI training for your school, team, or business, you can also reply to this email or contact me here: <a href="${escapeHtml(contactUrl)}">${escapeHtml(contactUrl)}</a></p>`,
    `<p>For children and families, the current practical learning path is here: <a href="${escapeHtml(coursesUrl)}">Prompt to Profit</a>.</p>`
  ].join("")
  return { subject: "Welcome to my practical AI notes", html: body, text: stripHtml(body) }
}

function leadMagnetEmail(input: { firstName: string; title: string; pdfUrl: string; deliveryMessage?: string | null; emailSubject?: string | null; blogTitle?: string | null }) {
  const intro = clean(input.deliveryMessage, 2000) || "Here is the guide I promised. Use it as a quick reference while the article is still fresh."
  const body = [
    `<p>Hi ${escapeHtml(input.firstName || "there")},</p>`,
    `<p>${escapeHtml(intro)}</p>`,
    input.blogTitle ? `<p>You requested this after reading: <strong>${escapeHtml(input.blogTitle)}</strong>.</p>` : "",
    `<p><a href="${escapeHtml(input.pdfUrl)}">Download the PDF</a></p>`,
    `<p>In about a week, I will start sending you practical AI notes that help you move from reading to building.</p>`
  ].filter(Boolean).join("")
  return { subject: clean(input.emailSubject, 255) || `${input.title} is ready`, html: body, text: stripHtml(body) }
}

export async function subscribeMarketingLead(body: Record<string, unknown>) {
  const firstName = clean(body.firstName || body.first_name, 120)
  const email = normalizeEmail(body.email)
  const leadMagnetSlug = clean(body.leadMagnetSlug || body.lead_magnet_slug, 255)
  if (!firstName) throw new Error("First name is required.")
  if (!EMAIL_RE.test(email)) throw new Error("A valid email address is required.")

  let leadMagnet: Awaited<ReturnType<typeof prisma.tochukwuBlogLeadMagnet.findFirst>> = null
  let post: Awaited<ReturnType<typeof prisma.tochukwuBlogPost.findUnique>> = null
  if (leadMagnetSlug) {
    leadMagnet = await prisma.tochukwuBlogLeadMagnet.findFirst({
      where: { slug: leadMagnetSlug, status: "active" }
    })
    if (!leadMagnet) throw new Error("This PDF offer is no longer available.")
    if (!leadMagnet.pdfUrl) throw new Error("This PDF is not ready yet.")
    post = await prisma.tochukwuBlogPost.findUnique({ where: { pidBlog: leadMagnet.pidBlog } }).catch(() => null)
  }

  const listId = toInt(leadMagnet?.brevoListId, DEFAULT_BREVO_LIST_ID)
  const pageType = clean(body.pageType || body.page_type, 40) || (leadMagnet ? "blog" : "")
  const source = clean(body.source, 100) || (leadMagnet ? "blog_lead_magnet" : "lead_capture_popup")
  const leadTrack = leadMagnet ? "blog_pdf" : pageType === "blog" ? "blog_newsletter" : pageType || "site"
  const pdfUrl = leadMagnet ? absoluteUrl(leadMagnet.pdfUrl) : ""
  const blogSlug = clean(post?.blogSlug || body.blogSlug || body.blog_slug, 255)
  const blogPid = clean(post?.pidBlog || leadMagnet?.pidBlog || body.blogPid || body.blog_pid, 64)

  const brevo = await syncBrevoSubscriber({
    fullName: firstName,
    email,
    listId,
    attributes: {
      JOINED_FROM: source,
      LEAD_TRACK: leadTrack,
      BLOG_SLUG: blogSlug,
      BLOG_TITLE: clean(post?.blogTitle || body.blogTitle || body.blog_title, 255),
      LEAD_MAGNET_SLUG: leadMagnet?.slug || "",
      LEAD_MAGNET_TITLE: leadMagnet?.title || "",
      PDF_URL: pdfUrl,
      UTM_SOURCE: clean(body.utmSource || body.utm_source, 190),
      UTM_CAMPAIGN: clean(body.utmCampaign || body.utm_campaign, 190),
      FBCLID: clean(body.fbclid, 190),
      LAST_CAPTURED_AT: new Date().toISOString()
    }
  })
  if (!brevo.ok) throw new Error(brevo.error || "Could not subscribe right now.")

  const marketingLead = await createMarketingLead({
    firstName,
    email,
    listId,
    source,
    pageType,
    pageUrl: clean(body.pageUrl || body.page_url, 2000),
    pathname: clean(body.pathname, 500),
    referrer: clean(body.referrer, 2000),
    utmSource: clean(body.utmSource || body.utm_source, 190),
    utmMedium: clean(body.utmMedium || body.utm_medium, 190),
    utmCampaign: clean(body.utmCampaign || body.utm_campaign, 190),
    utmContent: clean(body.utmContent || body.utm_content, 190),
    utmTerm: clean(body.utmTerm || body.utm_term, 190),
    fbclid: clean(body.fbclid, 2000),
    fbp: clean(body.fbp, 190),
    fbc: clean(body.fbc, 190),
    leadTrack,
    blogPid,
    blogSlug,
    leadMagnetSlug: leadMagnet?.slug || "",
    leadMagnetTitle: leadMagnet?.title || "",
    pdfUrl
  })

  await sendMetaLeadEvent({
    eventId: clean(body.metaEventId || body.meta_event_id, 190) || `lead_${marketingLead.leadUuid}`,
    email,
    firstName,
    eventSourceUrl: clean(body.pageUrl || body.page_url, 2000),
    fbp: clean(body.fbp, 190),
    fbc: clean(body.fbc, 190),
    fbclid: clean(body.fbclid, 2000),
    externalId: marketingLead.leadUuid,
    clientIp: clean(body.clientIp || body.client_ip, 80),
    userAgent: clean(body.userAgent || body.user_agent, 500),
    contentName: leadMagnet ? leadMagnet.title : "Tochukwu Website Lead Capture Popup",
    contentCategory: pageType || "site"
  }).catch(() => null)

  if (leadMagnet) {
    await createBlogLeadSubmission({
      magnetUuid: leadMagnet.magnetUuid,
      pidBlog: leadMagnet.pidBlog,
      firstName,
      email,
      marketingLeadUuid: marketingLead.leadUuid,
      listId,
      source,
      pageType,
      pageUrl: clean(body.pageUrl || body.page_url, 2000),
      pathname: clean(body.pathname, 500),
      referrer: clean(body.referrer, 2000),
      utmSource: clean(body.utmSource || body.utm_source, 190),
      utmMedium: clean(body.utmMedium || body.utm_medium, 190),
      utmCampaign: clean(body.utmCampaign || body.utm_campaign, 190),
      utmContent: clean(body.utmContent || body.utm_content, 190),
      utmTerm: clean(body.utmTerm || body.utm_term, 190),
      fbclid: clean(body.fbclid, 2000),
      fbp: clean(body.fbp, 190),
      fbc: clean(body.fbc, 190)
    })
  }

  let deliveryEmailSent = false
  try {
    const mail = leadMagnet && pdfUrl
      ? leadMagnetEmail({
          firstName,
          title: leadMagnet.title,
          pdfUrl,
          deliveryMessage: leadMagnet.deliveryMessage,
          emailSubject: leadMagnet.emailSubject,
          blogTitle: post?.blogTitle
        })
      : welcomeEmail({ firstName, pageType, pathname: clean(body.pathname, 500) })
    await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text })
    deliveryEmailSent = true
  } catch (_error) {
    deliveryEmailSent = false
  }

  return {
    listId,
    leadUuid: marketingLead.leadUuid,
    message: leadMagnet ? "Subscription successful. Your PDF is ready." : "Subscription successful.",
    welcomeEmailSent: leadMagnet ? undefined : deliveryEmailSent,
    leadMagnet: leadMagnet ? {
      title: leadMagnet.title,
      slug: leadMagnet.slug,
      pdfUrl,
      deliveryEmailSent
    } : null
  }
}

function mapLeadRow(row: {
  id: number | bigint
  leadUuid: string | null
  firstName: string | null
  email: string | null
  listId: number | bigint | null
  source: string | null
  pageType: string | null
  pageUrl: string | null
  pathname: string | null
  referrer: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  utmTerm: string | null
  fbclid: string | null
  fbp: string | null
  fbc: string | null
  leadTrack: string | null
  blogPid: string | null
  blogSlug: string | null
  leadMagnetSlug: string | null
  leadMagnetTitle: string | null
  pdfUrl: string | null
  createdAt: Date | null
  updatedAt: Date | null
}): MarketingLeadRow {
  return {
    id: toInt(row.id),
    leadUuid: clean(row.leadUuid, 80),
    firstName: clean(row.firstName, 120),
    email: normalizeEmail(row.email),
    listId: toInt(row.listId),
    source: clean(row.source, 100),
    pageType: clean(row.pageType, 40),
    pageUrl: clean(row.pageUrl, 2000),
    pathname: clean(row.pathname, 500),
    referrer: clean(row.referrer, 2000),
    utmSource: clean(row.utmSource, 190),
    utmMedium: clean(row.utmMedium, 190),
    utmCampaign: clean(row.utmCampaign, 190),
    utmContent: clean(row.utmContent, 190),
    utmTerm: clean(row.utmTerm, 190),
    fbclid: clean(row.fbclid, 2000),
    fbp: clean(row.fbp, 190),
    fbc: clean(row.fbc, 190),
    leadTrack: clean(row.leadTrack, 120),
    blogPid: clean(row.blogPid, 64),
    blogSlug: clean(row.blogSlug, 255),
    leadMagnetSlug: clean(row.leadMagnetSlug, 255),
    leadMagnetTitle: clean(row.leadMagnetTitle, 255),
    pdfUrl: clean(row.pdfUrl, 2000),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export async function getMarketingDashboard(input: { days?: number; limit?: number } = {}): Promise<MarketingDashboard> {
  await ensureMarketingLeadsTable()
  const days = Math.min(365, Math.max(1, toInt(input.days, 30)))
  const limit = Math.min(300, Math.max(1, toInt(input.limit, 100)))

  const [summaryRows, recentRows, sources, pages, campaigns, daily] = await Promise.all([
    prisma.$queryRaw<Array<{ totalLeads: number | bigint | null; periodLeads: number | bigint | null; uniqueEmails: number | bigint | null; convertingPages: number | bigint | null }>>`
      SELECT
        COUNT(*) AS totalLeads,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY) THEN 1 ELSE 0 END) AS periodLeads,
        COUNT(DISTINCT email) AS uniqueEmails,
        COUNT(DISTINCT pathname) AS convertingPages
      FROM tochukwu_marketing_leads
    `,
    prisma.$queryRaw<Array<Parameters<typeof mapLeadRow>[0]>>`
      SELECT
        id, lead_uuid AS leadUuid, first_name AS firstName, email, list_id AS listId, source, page_type AS pageType,
        page_url AS pageUrl, pathname, referrer, utm_source AS utmSource, utm_medium AS utmMedium,
        utm_campaign AS utmCampaign, utm_content AS utmContent, utm_term AS utmTerm, fbclid, fbp, fbc,
        lead_track AS leadTrack, blog_pid AS blogPid, blog_slug AS blogSlug, lead_magnet_slug AS leadMagnetSlug,
        lead_magnet_title AS leadMagnetTitle, pdf_url AS pdfUrl, created_at AS createdAt, updated_at AS updatedAt
      FROM tochukwu_marketing_leads
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `,
    prisma.$queryRaw<MarketingChartRow[]>`
      SELECT COALESCE(NULLIF(utm_source, ''), NULLIF(source, ''), 'direct/unknown') AS label, COUNT(*) AS leads
      FROM tochukwu_marketing_leads
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
      GROUP BY label
      ORDER BY leads DESC, label ASC
      LIMIT 12
    `,
    prisma.$queryRaw<MarketingChartRow[]>`
      SELECT COALESCE(NULLIF(pathname, ''), '/') AS label, COUNT(*) AS leads
      FROM tochukwu_marketing_leads
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
      GROUP BY label
      ORDER BY leads DESC, label ASC
      LIMIT 12
    `,
    prisma.$queryRaw<MarketingChartRow[]>`
      SELECT COALESCE(NULLIF(utm_campaign, ''), 'none') AS label, COUNT(*) AS leads
      FROM tochukwu_marketing_leads
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
      GROUP BY label
      ORDER BY leads DESC, label ASC
      LIMIT 12
    `,
    prisma.$queryRaw<MarketingChartRow[]>`
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS label, COUNT(*) AS leads
      FROM tochukwu_marketing_leads
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
      GROUP BY label
      ORDER BY label ASC
    `
  ])

  const summary = summaryRows[0]
  return {
    days,
    summary: {
      totalLeads: toInt(summary?.totalLeads),
      periodLeads: toInt(summary?.periodLeads),
      uniqueEmails: toInt(summary?.uniqueEmails),
      convertingPages: toInt(summary?.convertingPages)
    },
    recentLeads: recentRows.map(mapLeadRow),
    sources: sources.map((row) => ({ label: clean(row.label, 190), leads: toInt(row.leads) })),
    pages: pages.map((row) => ({ label: clean(row.label, 500), leads: toInt(row.leads) })),
    campaigns: campaigns.map((row) => ({ label: clean(row.label, 190), leads: toInt(row.leads) })),
    daily: daily.map((row) => ({ label: clean(row.label, 20), leads: toInt(row.leads) }))
  }
}

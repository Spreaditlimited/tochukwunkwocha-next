import crypto from "crypto"

import { prisma } from "@/lib/prisma"
import { createResourceDownloadToken } from "@/lib/resource-download-token"
import { slugify } from "@/lib/utils"

export const resourceTypes = [
  { key: "video", label: "Video" },
  { key: "prompt", label: "Prompt" }
] as const

export const resourceAccessTypes = [
  { key: "free", label: "Free" },
  { key: "gated", label: "Gated Free" }
] as const

export const resourceAudiences = [
  { key: "waec-jamb-learners", label: "WAEC/JAMB Learners", description: "Practical AI help for exam preparation, study structure, revision, and learning confidence." },
  { key: "parents", label: "Parents", description: "Guides that help parents understand AI, online safety, learning support, and children's digital development." },
  { key: "teachers", label: "Teachers", description: "Classroom-ready resources for lesson planning, feedback, assessment, productivity, and responsible AI use." },
  { key: "school-owners", label: "School Owners", description: "AI strategy, policy, operations, staff training, and growth resources for school leaders." },
  { key: "nysc-job-seekers", label: "NYSC/Job Seekers", description: "AI-supported career resources for CVs, portfolios, applications, interviews, and practical skill building." },
  { key: "small-business-owners", label: "Small Business Owners", description: "Operational AI toolkits for marketing, sales, customer support, admin, and business workflows." },
  { key: "non-technical-founders", label: "Non-Technical Founders", description: "Resources for validating, planning, prototyping, and building digital products with AI." },
  { key: "children-ai-safety", label: "Children & AI Safety", description: "Age-aware resources for safe, productive, and supervised AI learning for children." },
  { key: "building-real-projects", label: "Building Real Projects", description: "Practical project-based resources for websites, software, dashboards, and useful digital tools." },
  { key: "governments-public-institutions", label: "Governments & Public Institutions", description: "AI productivity, service delivery, policy, training, and responsible adoption resources for public-sector teams." },
  { key: "university-students", label: "University Students", description: "Prompts for coursework, research, presentations, study planning, and career preparation." },
  { key: "polytechnic-students", label: "Polytechnic Students", description: "Prompts for practical assignments, projects, technical reports, and workplace readiness." },
  { key: "undergraduates-final-year", label: "Final-Year Students", description: "Prompts for final-year projects, research structure, presentations, and defense preparation." },
  { key: "postgraduate-researchers", label: "Postgraduate Researchers", description: "Prompts for research planning, literature review, methodology, and academic writing support." },
  { key: "lecturers-academics", label: "Lecturers & Academics", description: "Prompts for lecture planning, research supervision, assessment, feedback, and publication workflows." },
  { key: "school-administrators", label: "School Administrators", description: "Prompts for school operations, records, parent communication, staff coordination, and reporting." },
  { key: "private-tutors", label: "Private Tutors", description: "Prompts for lesson planning, learner diagnosis, parent updates, worksheets, and revision support." },
  { key: "online-course-creators", label: "Online Course Creators", description: "Prompts for course outlines, lesson scripts, exercises, sales pages, and learner engagement." },
  { key: "corporate-trainers", label: "Corporate Trainers", description: "Prompts for training design, facilitation guides, exercises, assessments, and learner follow-up." },
  { key: "hr-professionals", label: "HR Professionals", description: "Prompts for job descriptions, onboarding, staff communication, policies, and performance support." },
  { key: "customer-support-teams", label: "Customer Support Teams", description: "Prompts for support replies, escalation notes, knowledge base articles, and complaint handling." },
  { key: "sales-professionals", label: "Sales Professionals", description: "Prompts for prospecting, follow-up, objections, proposals, and customer relationship management." },
  { key: "marketers", label: "Marketers", description: "Prompts for campaign planning, content ideas, audience research, copy review, and reporting." },
  { key: "social-media-managers", label: "Social Media Managers", description: "Prompts for content calendars, captions, community replies, analytics, and campaign ideas." },
  { key: "content-creators", label: "Content Creators", description: "Prompts for video ideas, scripts, hooks, captions, repurposing, and publishing consistency." },
  { key: "youtube-creators", label: "YouTube Creators", description: "Prompts for video strategy, titles, thumbnails, scripts, outlines, and audience retention." },
  { key: "tiktok-instagram-creators", label: "TikTok & Instagram Creators", description: "Prompts for short-form hooks, scripts, series ideas, captions, and content batching." },
  { key: "writers-bloggers", label: "Writers & Bloggers", description: "Prompts for article planning, editing, research angles, headlines, and content improvement." },
  { key: "designers-creatives", label: "Designers & Creatives", description: "Prompts for briefs, concepts, client communication, portfolio stories, and creative direction." },
  { key: "software-developers", label: "Software Developers", description: "Prompts for debugging, architecture thinking, documentation, code review, and feature planning." },
  { key: "product-managers", label: "Product Managers", description: "Prompts for product strategy, user stories, roadmaps, discovery, and stakeholder communication." },
  { key: "data-analysts", label: "Data Analysts", description: "Prompts for data cleaning, analysis plans, dashboard narratives, SQL help, and insight communication." },
  { key: "lawyers-legal-teams", label: "Lawyers & Legal Teams", description: "Prompts for drafting support, research organization, client communication, and document review workflows." },
  { key: "accountants-finance-teams", label: "Accountants & Finance Teams", description: "Prompts for reporting, reconciliation notes, client explanations, budgeting, and finance communication." },
  { key: "healthcare-administrators", label: "Healthcare Administrators", description: "Prompts for patient communication, operations, staff notes, training materials, and admin workflows." },
  { key: "ngo-nonprofit-teams", label: "NGO & Nonprofit Teams", description: "Prompts for grant writing, impact reporting, donor communication, programme design, and field operations." },
  { key: "grant-writers", label: "Grant Writers", description: "Prompts for proposals, needs statements, impact frameworks, budgets, and donor reporting." },
  { key: "church-ministry-teams", label: "Church & Ministry Teams", description: "Prompts for communication, volunteer coordination, teaching outlines, events, and media planning." },
  { key: "event-planners", label: "Event Planners", description: "Prompts for event briefs, vendor communication, schedules, checklists, and client updates." },
  { key: "real-estate-professionals", label: "Real Estate Professionals", description: "Prompts for property descriptions, client follow-up, listing content, viewing scripts, and market education." },
  { key: "farmers-agribusiness", label: "Farmers & Agribusiness", description: "Prompts for farm planning, customer education, record keeping, marketing, and operations." },
  { key: "ecommerce-sellers", label: "Ecommerce Sellers", description: "Prompts for product pages, customer replies, offers, reviews, and store operations." },
  { key: "import-export-traders", label: "Import & Export Traders", description: "Prompts for supplier communication, product research, customer education, and trading workflows." },
  { key: "freelancers-consultants", label: "Freelancers & Consultants", description: "Prompts for proposals, client onboarding, project scopes, reporting, and service packaging." },
  { key: "executives-managers", label: "Executives & Managers", description: "Prompts for decision briefs, meeting summaries, delegation, strategy notes, and team communication." },
  { key: "personal-productivity", label: "Personal Productivity", description: "Prompts for planning, prioritization, habit building, reflection, and everyday decision support." },
  { key: "diaspora-professionals", label: "Diaspora Professionals", description: "Prompts for cross-border work, relocation planning, professional communication, and African market context." },
  { key: "civil-servants", label: "Civil Servants", description: "Prompts for memos, public communication, policy notes, reporting, and responsible productivity." },
  { key: "local-government-officers", label: "Local Government Officers", description: "Prompts for citizen communication, service documentation, meeting notes, and local programme planning." },
  { key: "ai-beginners", label: "AI Beginners", description: "Prompts for learning AI basics, practicing safely, asking better questions, and building confidence." }
] as const

export const resourceCategories = [
  { key: "study", label: "Study & Learning" },
  { key: "career", label: "Career & Work" },
  { key: "business", label: "Business Operations" },
  { key: "schools", label: "Schools & Education" },
  { key: "safety", label: "AI Safety" },
  { key: "productivity", label: "Productivity" },
  { key: "project-building", label: "Project Building" },
  { key: "public-sector", label: "Public Sector" }
] as const

export type ResourceType = typeof resourceTypes[number]["key"] | "download" | "guide"
export type ResourceAccessType = typeof resourceAccessTypes[number]["key"] | "paid" | "bundle_only"

export type ResourceRow = {
  id: number
  resourceUuid: string
  resourceType: ResourceType
  audienceKey: string
  categoryKey: string
  title: string
  slug: string
  summary: string
  bodyContent: string
  promptText: string
  useCaseText: string
  customizationNotes: string
  videoUrl: string
  thumbnailUrl: string
  downloadUrl: string
  filePublicId: string
  accessType: ResourceAccessType
  priceNgnMinor: number
  priceUsdMinor: number
  brevoListId: number
  relatedCourseSlug: string
  seoTitle: string
  seoDescription: string
  ogImage: string
  status: string
  featured: boolean
  createdAt: Date | null
  updatedAt: Date | null
  publishedAt: Date | null
}

export type ResourceBundleRow = {
  id: number
  bundleUuid: string
  title: string
  slug: string
  summary: string
  description: string
  audienceKey: string
  priceNgnMinor: number
  priceUsdMinor: number
  status: string
  featured: boolean
  resourceCount: number
  createdAt: Date | null
  updatedAt: Date | null
  publishedAt: Date | null
}

function clean(value: unknown, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

function toMinor(value: unknown) {
  const amount = Number(String(value || "").replace(/[,\s]/g, ""))
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0
}

function toInt(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.round(numberValue) : 0
}

function rowToResource(row: Record<string, unknown>): ResourceRow {
  return {
    id: Number(row.id || 0),
    resourceUuid: clean(row.resourceUuid || row.resource_uuid, 80),
    resourceType: clean(row.resourceType || row.resource_type, 40) as ResourceType,
    audienceKey: clean(row.audienceKey || row.audience_key, 80),
    categoryKey: clean(row.categoryKey || row.category_key, 80),
    title: clean(row.title, 220),
    slug: clean(row.slug, 255),
    summary: clean(row.summary, 500),
    bodyContent: clean(row.bodyContent || row.body_content, 20000),
    promptText: clean(row.promptText || row.prompt_text, 20000),
    useCaseText: clean(row.useCaseText || row.use_case_text, 4000),
    customizationNotes: clean(row.customizationNotes || row.customization_notes, 8000),
    videoUrl: clean(row.videoUrl || row.video_url, 2000),
    thumbnailUrl: clean(row.thumbnailUrl || row.thumbnail_url, 2000),
    downloadUrl: clean(row.downloadUrl || row.download_url, 2000),
    filePublicId: clean(row.filePublicId || row.file_public_id, 500),
    accessType: clean(row.accessType || row.access_type, 40) as ResourceAccessType,
    priceNgnMinor: Number(row.priceNgnMinor || row.price_ngn_minor || 0),
    priceUsdMinor: Number(row.priceUsdMinor || row.price_usd_minor || 0),
    brevoListId: Number(row.brevoListId || row.brevo_list_id || 0),
    relatedCourseSlug: clean(row.relatedCourseSlug || row.related_course_slug, 160),
    seoTitle: clean(row.seoTitle || row.seo_title, 220),
    seoDescription: clean(row.seoDescription || row.seo_description, 320),
    ogImage: clean(row.ogImage || row.og_image, 2000),
    status: clean(row.status, 32),
    featured: Number(row.featured || 0) === 1,
    createdAt: row.createdAt || row.created_at ? new Date(row.createdAt as string || row.created_at as string) : null,
    updatedAt: row.updatedAt || row.updated_at ? new Date(row.updatedAt as string || row.updated_at as string) : null,
    publishedAt: row.publishedAt || row.published_at ? new Date(row.publishedAt as string || row.published_at as string) : null
  }
}

function rowToBundle(row: Record<string, unknown>): ResourceBundleRow {
  return {
    id: Number(row.id || 0),
    bundleUuid: clean(row.bundleUuid || row.bundle_uuid, 80),
    title: clean(row.title, 220),
    slug: clean(row.slug, 255),
    summary: clean(row.summary, 500),
    description: clean(row.description, 12000),
    audienceKey: clean(row.audienceKey || row.audience_key, 80),
    priceNgnMinor: Number(row.priceNgnMinor || row.price_ngn_minor || 0),
    priceUsdMinor: Number(row.priceUsdMinor || row.price_usd_minor || 0),
    status: clean(row.status, 32),
    featured: Number(row.featured || 0) === 1,
    resourceCount: Number(row.resourceCount || row.resource_count || 0),
    createdAt: row.createdAt || row.created_at ? new Date(row.createdAt as string || row.created_at as string) : null,
    updatedAt: row.updatedAt || row.updated_at ? new Date(row.updatedAt as string || row.updated_at as string) : null,
    publishedAt: row.publishedAt || row.published_at ? new Date(row.publishedAt as string || row.published_at as string) : null
  }
}

export function audienceLabel(key: string) {
  return resourceAudiences.find((audience) => audience.key === key)?.label || key
}

export function categoryLabel(key: string) {
  return resourceCategories.find((category) => category.key === key)?.label || key
}

export function resourceTypeLabel(key: string) {
  return resourceTypes.find((type) => type.key === key)?.label || key
}

export function accessTypeLabel(key: string) {
  return resourceAccessTypes.find((type) => type.key === key)?.label || key
}

export function formatResourcePrice(resource: Pick<ResourceRow | ResourceBundleRow, "priceNgnMinor" | "priceUsdMinor">) {
  if (resource.priceNgnMinor > 0) return `NGN ${(resource.priceNgnMinor / 100).toLocaleString("en-NG")}`
  if (resource.priceUsdMinor > 0) return `USD ${(resource.priceUsdMinor / 100).toLocaleString("en-US")}`
  return ""
}

export async function ensureResourceTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_resource_audiences (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      audience_key VARCHAR(80) NOT NULL,
      label VARCHAR(160) NOT NULL,
      description TEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_resource_audience_key (audience_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_resource_categories (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      category_key VARCHAR(80) NOT NULL,
      label VARCHAR(160) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_resource_category_key (category_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_resources (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      resource_uuid VARCHAR(80) NOT NULL,
      resource_type VARCHAR(40) NOT NULL,
      audience_key VARCHAR(80) NOT NULL,
      category_key VARCHAR(80) NOT NULL,
      title VARCHAR(220) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      summary TEXT NULL,
      body_content LONGTEXT NULL,
      prompt_text LONGTEXT NULL,
      use_case_text TEXT NULL,
      customization_notes LONGTEXT NULL,
      video_url TEXT NULL,
      thumbnail_url TEXT NULL,
      download_url TEXT NULL,
      file_public_id VARCHAR(500) NULL,
      access_type VARCHAR(40) NOT NULL DEFAULT 'free',
      price_ngn_minor INT NOT NULL DEFAULT 0,
      price_usd_minor INT NOT NULL DEFAULT 0,
      brevo_list_id BIGINT NULL,
      related_course_slug VARCHAR(160) NULL,
      seo_title VARCHAR(220) NULL,
      seo_description VARCHAR(320) NULL,
      og_image TEXT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'draft',
      featured TINYINT(1) NOT NULL DEFAULT 0,
      generated_json LONGTEXT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      published_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_resource_uuid (resource_uuid),
      UNIQUE KEY uniq_resource_slug (slug),
      KEY idx_resource_status_type (status, resource_type, published_at),
      KEY idx_resource_audience (audience_key, status, published_at),
      KEY idx_resource_category (category_key, status, published_at),
      KEY idx_resource_access (access_type, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_resource_bundles (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      bundle_uuid VARCHAR(80) NOT NULL,
      title VARCHAR(220) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      summary TEXT NULL,
      description LONGTEXT NULL,
      audience_key VARCHAR(80) NULL,
      price_ngn_minor INT NOT NULL DEFAULT 0,
      price_usd_minor INT NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'draft',
      featured TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      published_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_resource_bundle_uuid (bundle_uuid),
      UNIQUE KEY uniq_resource_bundle_slug (slug),
      KEY idx_resource_bundle_status (status, published_at),
      KEY idx_resource_bundle_audience (audience_key, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_resource_bundle_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      bundle_uuid VARCHAR(80) NOT NULL,
      resource_uuid VARCHAR(80) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_resource_bundle_item (bundle_uuid, resource_uuid),
      KEY idx_resource_bundle_items_bundle (bundle_uuid, sort_order),
      KEY idx_resource_bundle_items_resource (resource_uuid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_resource_orders (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_uuid VARCHAR(80) NOT NULL,
      resource_uuid VARCHAR(80) NULL,
      bundle_uuid VARCHAR(80) NULL,
      email VARCHAR(190) NOT NULL,
      first_name VARCHAR(120) NULL,
      currency VARCHAR(8) NOT NULL,
      amount_minor INT NOT NULL DEFAULT 0,
      payment_provider VARCHAR(40) NULL,
      payment_reference VARCHAR(190) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      paid_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_resource_order_uuid (order_uuid),
      KEY idx_resource_order_email (email),
      KEY idx_resource_order_resource (resource_uuid, status),
      KEY idx_resource_order_bundle (bundle_uuid, status),
      KEY idx_resource_order_reference (payment_provider, payment_reference)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_resource_leads (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      lead_uuid VARCHAR(80) NOT NULL,
      resource_uuid VARCHAR(80) NOT NULL,
      first_name VARCHAR(120) NULL,
      email VARCHAR(190) NOT NULL,
      source VARCHAR(100) NULL,
      page_url TEXT NULL,
      pathname VARCHAR(500) NULL,
      brevo_list_id BIGINT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_resource_lead_uuid (lead_uuid),
      KEY idx_resource_lead_resource (resource_uuid, created_at),
      KEY idx_resource_lead_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_resource_generation_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      log_uuid VARCHAR(80) NOT NULL,
      resource_uuid VARCHAR(80) NULL,
      generation_type VARCHAR(60) NOT NULL,
      prompt LONGTEXT NULL,
      result_json LONGTEXT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'completed',
      error_message TEXT NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_resource_generation_log_uuid (log_uuid),
      KEY idx_resource_generation_resource (resource_uuid, created_at),
      KEY idx_resource_generation_type (generation_type, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const now = new Date()
  for (const [index, audience] of resourceAudiences.entries()) {
    await prisma.$executeRaw`
      INSERT INTO tochukwu_resource_audiences (audience_key, label, description, sort_order, is_active, created_at, updated_at)
      VALUES (${audience.key}, ${audience.label}, ${audience.description}, ${index + 1}, 1, ${now}, ${now})
      ON DUPLICATE KEY UPDATE label = VALUES(label), description = VALUES(description), sort_order = VALUES(sort_order), updated_at = VALUES(updated_at)
    `
  }
  for (const [index, category] of resourceCategories.entries()) {
    await prisma.$executeRaw`
      INSERT INTO tochukwu_resource_categories (category_key, label, sort_order, is_active, created_at, updated_at)
      VALUES (${category.key}, ${category.label}, ${index + 1}, 1, ${now}, ${now})
      ON DUPLICATE KEY UPDATE label = VALUES(label), sort_order = VALUES(sort_order), updated_at = VALUES(updated_at)
    `
  }
}

export async function makeUniqueResourceSlug(titleOrSlug: string, currentUuid?: string) {
  const base = slugify(titleOrSlug) || `resource-${Date.now()}`
  let candidate = base
  let index = 2
  while (true) {
    const rows = await prisma.$queryRaw<Array<{ resourceUuid: string }>>`
      SELECT resource_uuid AS resourceUuid FROM tochukwu_resources WHERE slug = ${candidate} LIMIT 1
    `
    if (!rows.length || rows[0].resourceUuid === currentUuid) return candidate
    candidate = `${base}-${index}`
    index += 1
  }
}

export async function makeUniqueBundleSlug(titleOrSlug: string, currentUuid?: string) {
  const base = slugify(titleOrSlug) || `toolkit-${Date.now()}`
  let candidate = base
  let index = 2
  while (true) {
    const rows = await prisma.$queryRaw<Array<{ bundleUuid: string }>>`
      SELECT bundle_uuid AS bundleUuid FROM tochukwu_resource_bundles WHERE slug = ${candidate} LIMIT 1
    `
    if (!rows.length || rows[0].bundleUuid === currentUuid) return candidate
    candidate = `${base}-${index}`
    index += 1
  }
}

export async function listAdminResources(search = "") {
  await ensureResourceTables()
  const q = `%${clean(search, 120)}%`
  const rows = clean(search)
    ? await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT id, resource_uuid AS resourceUuid, resource_type AS resourceType, audience_key AS audienceKey, category_key AS categoryKey,
          title, slug, summary, body_content AS bodyContent, prompt_text AS promptText, use_case_text AS useCaseText,
          customization_notes AS customizationNotes, video_url AS videoUrl, thumbnail_url AS thumbnailUrl, download_url AS downloadUrl,
          file_public_id AS filePublicId, access_type AS accessType, price_ngn_minor AS priceNgnMinor, price_usd_minor AS priceUsdMinor,
          brevo_list_id AS brevoListId, related_course_slug AS relatedCourseSlug, seo_title AS seoTitle, seo_description AS seoDescription,
          og_image AS ogImage, status, featured, created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt
        FROM tochukwu_resources
        WHERE title LIKE ${q} OR slug LIKE ${q} OR summary LIKE ${q} OR audience_key LIKE ${q}
        ORDER BY updated_at DESC
        LIMIT 150
      `
    : await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT id, resource_uuid AS resourceUuid, resource_type AS resourceType, audience_key AS audienceKey, category_key AS categoryKey,
          title, slug, summary, body_content AS bodyContent, prompt_text AS promptText, use_case_text AS useCaseText,
          customization_notes AS customizationNotes, video_url AS videoUrl, thumbnail_url AS thumbnailUrl, download_url AS downloadUrl,
          file_public_id AS filePublicId, access_type AS accessType, price_ngn_minor AS priceNgnMinor, price_usd_minor AS priceUsdMinor,
          brevo_list_id AS brevoListId, related_course_slug AS relatedCourseSlug, seo_title AS seoTitle, seo_description AS seoDescription,
          og_image AS ogImage, status, featured, created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt
        FROM tochukwu_resources
        ORDER BY updated_at DESC
        LIMIT 150
      `
  return rows.map(rowToResource)
}

export async function listPublishedResources(input: { type?: string; audience?: string; category?: string; search?: string; limit?: number } = {}) {
  await ensureResourceTables()
  const type = clean(input.type, 40)
  const audience = clean(input.audience, 80)
  const category = clean(input.category, 80)
  const search = clean(input.search, 120)
  const q = `%${search}%`
  const limit = Math.min(300, Math.max(1, input.limit || 36))
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, resource_uuid AS resourceUuid, resource_type AS resourceType, audience_key AS audienceKey, category_key AS categoryKey,
      title, slug, summary, body_content AS bodyContent, prompt_text AS promptText, use_case_text AS useCaseText,
      customization_notes AS customizationNotes, video_url AS videoUrl, thumbnail_url AS thumbnailUrl, download_url AS downloadUrl,
      file_public_id AS filePublicId, access_type AS accessType, price_ngn_minor AS priceNgnMinor, price_usd_minor AS priceUsdMinor,
      brevo_list_id AS brevoListId, related_course_slug AS relatedCourseSlug, seo_title AS seoTitle, seo_description AS seoDescription,
      og_image AS ogImage, status, featured, created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt
    FROM tochukwu_resources
    WHERE status = 'published'
      AND (${type} = '' OR resource_type = ${type})
      AND (${type} <> '' OR resource_type IN ('prompt', 'video'))
      AND (${audience} = '' OR audience_key = ${audience})
      AND (${category} = '' OR category_key = ${category})
      AND (${search} = '' OR title LIKE ${q} OR summary LIKE ${q} OR body_content LIKE ${q} OR prompt_text LIKE ${q} OR use_case_text LIKE ${q} OR customization_notes LIKE ${q})
    ORDER BY featured DESC, published_at DESC, updated_at DESC
    LIMIT ${limit}
  `
  return rows.map(rowToResource)
}

export async function getResourceBySlug(slug: string, includeDraft = false) {
  await ensureResourceTables()
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, resource_uuid AS resourceUuid, resource_type AS resourceType, audience_key AS audienceKey, category_key AS categoryKey,
      title, slug, summary, body_content AS bodyContent, prompt_text AS promptText, use_case_text AS useCaseText,
      customization_notes AS customizationNotes, video_url AS videoUrl, thumbnail_url AS thumbnailUrl, download_url AS downloadUrl,
      file_public_id AS filePublicId, access_type AS accessType, price_ngn_minor AS priceNgnMinor, price_usd_minor AS priceUsdMinor,
      brevo_list_id AS brevoListId, related_course_slug AS relatedCourseSlug, seo_title AS seoTitle, seo_description AS seoDescription,
      og_image AS ogImage, status, featured, created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt
    FROM tochukwu_resources
    WHERE slug = ${clean(slug, 255)}
      AND (${includeDraft ? 1 : 0} = 1 OR status = 'published')
    LIMIT 1
  `
  return rows[0] ? rowToResource(rows[0]) : null
}

export async function listAdminBundles() {
  await ensureResourceTables()
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT b.id, b.bundle_uuid AS bundleUuid, b.title, b.slug, b.summary, b.description, b.audience_key AS audienceKey,
      b.price_ngn_minor AS priceNgnMinor, b.price_usd_minor AS priceUsdMinor, b.status, b.featured,
      b.created_at AS createdAt, b.updated_at AS updatedAt, b.published_at AS publishedAt,
      COUNT(i.id) AS resourceCount
    FROM tochukwu_resource_bundles b
    LEFT JOIN tochukwu_resource_bundle_items i ON i.bundle_uuid = b.bundle_uuid
    GROUP BY b.id
    ORDER BY b.updated_at DESC
    LIMIT 100
  `
  return rows.map(rowToBundle)
}

export async function listPublishedBundles(input: { audience?: string; limit?: number } = {}) {
  await ensureResourceTables()
  const audience = clean(input.audience, 80)
  const limit = Math.min(50, Math.max(1, input.limit || 12))
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT b.id, b.bundle_uuid AS bundleUuid, b.title, b.slug, b.summary, b.description, b.audience_key AS audienceKey,
      b.price_ngn_minor AS priceNgnMinor, b.price_usd_minor AS priceUsdMinor, b.status, b.featured,
      b.created_at AS createdAt, b.updated_at AS updatedAt, b.published_at AS publishedAt,
      COUNT(i.id) AS resourceCount
    FROM tochukwu_resource_bundles b
    LEFT JOIN tochukwu_resource_bundle_items i ON i.bundle_uuid = b.bundle_uuid
    WHERE b.status = 'published'
      AND (${audience} = '' OR b.audience_key = ${audience})
    GROUP BY b.id
    ORDER BY b.featured DESC, b.published_at DESC, b.updated_at DESC
    LIMIT ${limit}
  `
  return rows.map(rowToBundle)
}

export async function upsertResourceFromForm(formData: FormData) {
  await ensureResourceTables()
  const now = new Date()
  const resourceUuid = clean(formData.get("resourceUuid"), 80) || crypto.randomUUID()
  const title = clean(formData.get("title"), 220)
  if (!title) throw new Error("Resource title is required.")
  const status = clean(formData.get("status"), 32) === "published" ? "published" : "draft"
  const slug = await makeUniqueResourceSlug(clean(formData.get("slug"), 255) || title, resourceUuid)
  const publishedAt = status === "published" ? now : null

  await prisma.$executeRaw`
    INSERT INTO tochukwu_resources
      (resource_uuid, resource_type, audience_key, category_key, title, slug, summary, body_content, prompt_text,
       use_case_text, customization_notes, video_url, thumbnail_url, download_url, file_public_id, access_type,
       price_ngn_minor, price_usd_minor, brevo_list_id, related_course_slug, seo_title, seo_description, og_image,
       status, featured, created_at, updated_at, published_at)
    VALUES
      (${resourceUuid}, ${clean(formData.get("resourceType"), 40) || "guide"}, ${clean(formData.get("audienceKey"), 80) || "building-real-projects"},
       ${clean(formData.get("categoryKey"), 80) || "project-building"}, ${title}, ${slug}, ${clean(formData.get("summary"), 1000) || null},
       ${clean(formData.get("bodyContent"), 20000) || null}, ${clean(formData.get("promptText"), 20000) || null},
       ${clean(formData.get("useCaseText"), 4000) || null}, ${clean(formData.get("customizationNotes"), 8000) || null},
       ${clean(formData.get("videoUrl"), 2000) || null}, ${clean(formData.get("thumbnailUrl"), 2000) || null},
       ${clean(formData.get("downloadUrl"), 2000) || null}, ${clean(formData.get("filePublicId"), 500) || null},
       ${clean(formData.get("accessType"), 40) || "free"}, ${toMinor(formData.get("priceNgn"))}, ${toMinor(formData.get("priceUsd"))},
       ${toInt(formData.get("brevoListId")) || null}, ${clean(formData.get("relatedCourseSlug"), 160) || null},
       ${clean(formData.get("seoTitle"), 220) || null}, ${clean(formData.get("seoDescription"), 320) || null},
       ${clean(formData.get("ogImage"), 2000) || null}, ${status}, ${formData.get("featured") === "on" ? 1 : 0}, ${now}, ${now}, ${publishedAt})
    ON DUPLICATE KEY UPDATE
      resource_type = VALUES(resource_type),
      audience_key = VALUES(audience_key),
      category_key = VALUES(category_key),
      title = VALUES(title),
      slug = VALUES(slug),
      summary = VALUES(summary),
      body_content = VALUES(body_content),
      prompt_text = VALUES(prompt_text),
      use_case_text = VALUES(use_case_text),
      customization_notes = VALUES(customization_notes),
      video_url = VALUES(video_url),
      thumbnail_url = VALUES(thumbnail_url),
      download_url = VALUES(download_url),
      file_public_id = VALUES(file_public_id),
      access_type = VALUES(access_type),
      price_ngn_minor = VALUES(price_ngn_minor),
      price_usd_minor = VALUES(price_usd_minor),
      brevo_list_id = VALUES(brevo_list_id),
      related_course_slug = VALUES(related_course_slug),
      seo_title = VALUES(seo_title),
      seo_description = VALUES(seo_description),
      og_image = VALUES(og_image),
      status = VALUES(status),
      featured = VALUES(featured),
      updated_at = VALUES(updated_at),
      published_at = CASE
        WHEN VALUES(status) = 'published' AND published_at IS NULL THEN VALUES(published_at)
        WHEN VALUES(status) <> 'published' THEN NULL
        ELSE published_at
      END
  `
  return { resourceUuid, slug }
}

export async function upsertBundleFromForm(formData: FormData) {
  await ensureResourceTables()
  const now = new Date()
  const bundleUuid = clean(formData.get("bundleUuid"), 80) || crypto.randomUUID()
  const title = clean(formData.get("title"), 220)
  if (!title) throw new Error("Toolkit title is required.")
  const status = clean(formData.get("status"), 32) === "published" ? "published" : "draft"
  const slug = await makeUniqueBundleSlug(clean(formData.get("slug"), 255) || title, bundleUuid)
  const publishedAt = status === "published" ? now : null

  await prisma.$executeRaw`
    INSERT INTO tochukwu_resource_bundles
      (bundle_uuid, title, slug, summary, description, audience_key, price_ngn_minor, price_usd_minor, status, featured, created_at, updated_at, published_at)
    VALUES
      (${bundleUuid}, ${title}, ${slug}, ${clean(formData.get("summary"), 1000) || null}, ${clean(formData.get("description"), 12000) || null},
       ${clean(formData.get("audienceKey"), 80) || null}, ${toMinor(formData.get("priceNgn"))}, ${toMinor(formData.get("priceUsd"))},
       ${status}, ${formData.get("featured") === "on" ? 1 : 0}, ${now}, ${now}, ${publishedAt})
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      slug = VALUES(slug),
      summary = VALUES(summary),
      description = VALUES(description),
      audience_key = VALUES(audience_key),
      price_ngn_minor = VALUES(price_ngn_minor),
      price_usd_minor = VALUES(price_usd_minor),
      status = VALUES(status),
      featured = VALUES(featured),
      updated_at = VALUES(updated_at),
      published_at = CASE
        WHEN VALUES(status) = 'published' AND published_at IS NULL THEN VALUES(published_at)
        WHEN VALUES(status) <> 'published' THEN NULL
        ELSE published_at
      END
  `
  const selectedResources = formData
    .getAll("resourceUuids")
    .map((value) => clean(value, 80))
    .filter(Boolean)
  await prisma.$executeRaw`DELETE FROM tochukwu_resource_bundle_items WHERE bundle_uuid = ${bundleUuid}`
  for (const [index, resourceUuid] of selectedResources.entries()) {
    await prisma.$executeRaw`
      INSERT INTO tochukwu_resource_bundle_items (bundle_uuid, resource_uuid, sort_order, created_at)
      VALUES (${bundleUuid}, ${resourceUuid}, ${index + 1}, ${now})
      ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order)
    `
  }
  return { bundleUuid, slug }
}

type ResourceAiDraft = {
  title?: string
  summary?: string
  bodyContent?: string
  promptText?: string
  useCaseText?: string
  customizationNotes?: string
  seoTitle?: string
  seoDescription?: string
}

function resourceGenerationPrompt(input: {
  audienceKey: string
  categoryKey: string
  resourceType: string
  accessType: string
  topic: string
}) {
  const audience = audienceLabel(input.audienceKey)
  const category = categoryLabel(input.categoryKey)
  return [
    "Create a practical AI education resource for Tochukwu Tech and AI Academy.",
    "Context: The academy serves Nigerian and African learners, parents, teachers, school owners, job seekers, business owners, founders, children/safety audiences, project builders, and public-sector teams.",
    "The resource library now has only two active resource types: prompt and video. Do not create guides, downloads, worksheets, toolkits, or long generic articles.",
    "The content must be practical, local, outcome-based, and suitable for a premium AI education library. Do not produce shallow filler, generic AI advice, or thin checklist copy.",
    "Do not use a reusable universal structure that could apply to every audience. The sections, examples, scenarios, risks, prompts, and implementation steps must clearly belong to the selected audience and topic.",
    "Before writing, anchor the resource in the reader's real environment: Nigerian school calendar, WAEC/JAMB pressure, parent-child home rules, classroom workload, school admissions, NYSC/job search, WhatsApp commerce, founder validation, child safety, project building, or public-sector governance as appropriate.",
    "Every section must contain audience-specific details. If a paragraph would still make sense after replacing the audience with another audience, rewrite it.",
    "Use concrete examples, sample scripts, decision checklists, daily routines, mistakes, and review questions that match the audience. Avoid generic statements like 'AI can improve productivity' unless immediately tied to the audience's real work.",
    "Write directly to the reader in second person. Use you, your, and we where appropriate. Do not write the main content in distant third person such as 'the learner can', 'the user should', 'students can', or 'they should'.",
    "Keep voice consistent from beginning to end. If the resource is for WAEC/JAMB learners, speak to the student as 'you'. If a section is for parents, speak to the parent as 'you'.",
    "For prompt resources, identify one clear work area for the audience, then include 5-10 strong reusable prompts for that area. Each prompt must be immediately usable inside an AI tool.",
    "For video resources, create a strong title, summary, short video outline, and practical notes. Do not invent a video URL.",
    "Quality bar: the reader should feel this was written for their exact situation and should be able to apply it immediately without needing another article to understand what to do next.",
    "Return only valid JSON. Do not include markdown fences.",
    "",
    "Required JSON shape:",
    "{",
    '  "title": "max 90 chars",',
    '  "summary": "max 220 chars",',
    '  "bodyContent": "short context, video outline, or usage notes; not a long guide",',
    '  "promptText": "5-10 actual reusable prompts if resource type is prompt, otherwise empty string",',
    '  "useCaseText": "when and why to use this resource",',
    '  "customizationNotes": "how to adapt it to the user context",',
    '  "seoTitle": "max 70 chars",',
    '  "seoDescription": "max 155 chars"',
    "}",
    "",
    `Audience: ${audience} (${input.audienceKey})`,
    `Category: ${category} (${input.categoryKey})`,
    `Resource type: ${input.resourceType}`,
    `Access type: ${input.accessType}`,
    `Topic: ${input.topic}`,
    "",
    "Do not promise legal, medical, financial, or exam-result guarantees.",
    "Do not use hype. Make it useful enough that someone can apply it immediately."
  ].join("\n")
}

async function callOpenAiResourceDraft(prompt: string): Promise<ResourceAiDraft> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY.")
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_RESOURCE_MODEL || process.env.OPENAI_MODEL || "gpt-5.6",
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You create premium, practical educational resources as valid JSON. Write directly to the reader in consistent second person and never produce thin content." },
        { role: "user", content: prompt }
      ]
    })
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI resource generation failed (${response.status}).`)
  const content = payload?.choices?.[0]?.message?.content
  if (!content) throw new Error("OpenAI returned no resource content.")
  return JSON.parse(content)
}

export async function generateResourceDraftFromForm(formData: FormData) {
  await ensureResourceTables()
  const topic = clean(formData.get("topic"), 220)
  if (!topic) throw new Error("Topic is required.")
  const resourceType = clean(formData.get("resourceType"), 40) || "guide"
  const audienceKey = clean(formData.get("audienceKey"), 80) || "building-real-projects"
  const categoryKey = clean(formData.get("categoryKey"), 80) || "project-building"
  const accessType = clean(formData.get("accessType"), 40) || "free"
  const prompt = resourceGenerationPrompt({ audienceKey, categoryKey, resourceType, accessType, topic })
  const draft = await callOpenAiResourceDraft(prompt)
  const now = new Date()
  const title = clean(draft.title, 220) || topic
  const slug = await makeUniqueResourceSlug(title)
  const resourceUuid = crypto.randomUUID()

  await prisma.$executeRaw`
    INSERT INTO tochukwu_resources
      (resource_uuid, resource_type, audience_key, category_key, title, slug, summary, body_content, prompt_text,
       use_case_text, customization_notes, video_url, thumbnail_url, download_url, file_public_id, access_type,
       price_ngn_minor, price_usd_minor, brevo_list_id, related_course_slug, seo_title, seo_description, og_image,
       status, featured, generated_json, created_at, updated_at, published_at)
    VALUES
      (${resourceUuid}, ${resourceType}, ${audienceKey}, ${categoryKey}, ${title}, ${slug}, ${clean(draft.summary, 1000) || null},
       ${clean(draft.bodyContent, 20000) || null}, ${clean(draft.promptText, 20000) || null},
       ${clean(draft.useCaseText, 4000) || null}, ${clean(draft.customizationNotes, 8000) || null},
       NULL, NULL, NULL, NULL, ${accessType}, 0, 0, NULL, ${clean(formData.get("relatedCourseSlug"), 160) || null},
       ${clean(draft.seoTitle, 220) || title}, ${clean(draft.seoDescription, 320) || clean(draft.summary, 320) || null},
       NULL, 'draft', 0, ${JSON.stringify(draft)}, ${now}, ${now}, NULL)
  `

  await prisma.$executeRaw`
    INSERT INTO tochukwu_resource_generation_logs
      (log_uuid, resource_uuid, generation_type, prompt, result_json, status, error_message, created_at)
    VALUES
      (${crypto.randomUUID()}, ${resourceUuid}, 'resource_draft', ${prompt}, ${JSON.stringify(draft)}, 'completed', NULL, ${now})
  `

  return { resourceUuid, slug }
}

export async function captureResourceLead(input: {
  resourceUuid: string
  firstName: string
  email: string
  source?: string
  pageUrl?: string
  pathname?: string
}) {
  await ensureResourceTables()
  const email = clean(input.email, 190).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.")
  const rows = await prisma.$queryRaw<Array<{ brevoListId: number | bigint | null; slug: string; accessType: string }>>`
    SELECT brevo_list_id AS brevoListId, slug, access_type AS accessType
    FROM tochukwu_resources
    WHERE resource_uuid = ${clean(input.resourceUuid, 80)} AND status = 'published'
    LIMIT 1
  `
  if (!rows.length) throw new Error("Resource not found.")
  if (String(rows[0].accessType || "") !== "gated") throw new Error("This resource does not require unlock.")
  const now = new Date()
  const leadUuid = crypto.randomUUID()
  await prisma.$executeRaw`
    INSERT INTO tochukwu_resource_leads
      (lead_uuid, resource_uuid, first_name, email, source, page_url, pathname, brevo_list_id, created_at, updated_at)
    VALUES
      (${leadUuid}, ${clean(input.resourceUuid, 80)}, ${clean(input.firstName, 120) || null}, ${email},
       ${clean(input.source, 100) || "resource_gate"}, ${clean(input.pageUrl, 2000) || null},
       ${clean(input.pathname, 500) || null}, ${Number(rows[0].brevoListId || 0) || null}, ${now}, ${now})
  `
  const token = createResourceDownloadToken({ slug: clean(rows[0].slug, 255), email })
  return { leadUuid, downloadUrl: `/api/resources/${clean(rows[0].slug, 255)}/download?token=${encodeURIComponent(token)}` }
}

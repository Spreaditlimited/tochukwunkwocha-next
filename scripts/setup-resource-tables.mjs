import { PrismaClient } from "@prisma/client"
import fs from "node:fs"

function loadDotEnv(path = ".env") {
  if (!fs.existsSync(path)) return
  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#") || !line.includes("=")) continue
    const key = line.slice(0, line.indexOf("=")).trim()
    let value = line.slice(line.indexOf("=") + 1).trim()
    if (!key || process.env[key] != null) continue
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

loadDotEnv()

const prisma = new PrismaClient()
const now = new Date()

const audiences = [
  ["waec-jamb-learners", "WAEC/JAMB Learners", "Practical AI help for exam preparation, study structure, revision, and learning confidence."],
  ["parents", "Parents", "Guides that help parents understand AI, online safety, learning support, and children's digital development."],
  ["teachers", "Teachers", "Classroom-ready resources for lesson planning, feedback, assessment, productivity, and responsible AI use."],
  ["school-owners", "School Owners", "AI strategy, policy, operations, staff training, and growth resources for school leaders."],
  ["nysc-job-seekers", "NYSC/Job Seekers", "AI-supported career resources for CVs, portfolios, applications, interviews, and practical skill building."],
  ["small-business-owners", "Small Business Owners", "Operational AI toolkits for marketing, sales, customer support, admin, and business workflows."],
  ["non-technical-founders", "Non-Technical Founders", "Resources for validating, planning, prototyping, and building digital products with AI."],
  ["children-ai-safety", "Children & AI Safety", "Age-aware resources for safe, productive, and supervised AI learning for children."],
  ["building-real-projects", "Building Real Projects", "Practical project-based resources for websites, software, dashboards, and useful digital tools."],
  ["governments-public-institutions", "Governments & Public Institutions", "AI productivity, service delivery, policy, training, and responsible adoption resources for public-sector teams."]
]

const categories = [
  ["study", "Study & Learning"],
  ["career", "Career & Work"],
  ["business", "Business Operations"],
  ["schools", "Schools & Education"],
  ["safety", "AI Safety"],
  ["productivity", "Productivity"],
  ["project-building", "Project Building"],
  ["public-sector", "Public Sector"]
]

async function main() {
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

  for (const [index, audience] of audiences.entries()) {
    await prisma.$executeRaw`
      INSERT INTO tochukwu_resource_audiences (audience_key, label, description, sort_order, is_active, created_at, updated_at)
      VALUES (${audience[0]}, ${audience[1]}, ${audience[2]}, ${index + 1}, 1, ${now}, ${now})
      ON DUPLICATE KEY UPDATE label = VALUES(label), description = VALUES(description), sort_order = VALUES(sort_order), updated_at = VALUES(updated_at)
    `
  }

  for (const [index, category] of categories.entries()) {
    await prisma.$executeRaw`
      INSERT INTO tochukwu_resource_categories (category_key, label, sort_order, is_active, created_at, updated_at)
      VALUES (${category[0]}, ${category[1]}, ${index + 1}, 1, ${now}, ${now})
      ON DUPLICATE KEY UPDATE label = VALUES(label), sort_order = VALUES(sort_order), updated_at = VALUES(updated_at)
    `
  }

  console.log("tochukwu_resource_tables_ready")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

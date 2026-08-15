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

async function addColumnIfMissing(table, column, definition) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table,
    column
  )
  if (Number(rows[0]?.total || 0) === 0) {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
  }
}

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_search_console_import_runs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      run_uuid VARCHAR(80) NOT NULL,
      source VARCHAR(40) NOT NULL DEFAULT 'manual',
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME NULL,
      source_start_date DATE NULL,
      source_end_date DATE NULL,
      row_count INT NOT NULL DEFAULT 0,
      error_message TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_sc_run_uuid (run_uuid),
      KEY idx_tochukwu_sc_run_status (status, completed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_seo_linkable_pages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      pid_link VARCHAR(80) NOT NULL, url VARCHAR(1000) NOT NULL,
      normalized_url VARCHAR(500) NOT NULL, label VARCHAR(180) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'active', source VARCHAR(40) NOT NULL DEFAULT 'admin',
      approved_by VARCHAR(80) NULL, approved_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id), UNIQUE KEY uniq_tochukwu_seo_link_pid (pid_link),
      UNIQUE KEY uniq_tochukwu_seo_link_url (normalized_url), KEY idx_tochukwu_seo_link_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_seo_rewrite_artifacts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, pid_artifact VARCHAR(80) NOT NULL,
      pid_change VARCHAR(90) NOT NULL, source_content_hash CHAR(64) NOT NULL,
      rewritten_html LONGTEXT NULL, applied_changes_json LONGTEXT NULL,
      discovered_links_json LONGTEXT NULL, pending_links_json LONGTEXT NULL,
      decisions_json LONGTEXT NULL, external_link_changes_json LONGTEXT NULL,
      quality_policy_version VARCHAR(100) NULL, openai_response_id VARCHAR(100) NULL,
      openai_response_status VARCHAR(40) NULL, openai_model VARCHAR(80) NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'rewriting', error_code VARCHAR(80) NULL,
      error_message TEXT NULL, attempt_count INT NOT NULL DEFAULT 0,
      generated_at DATETIME(3) NULL, reviewed_at DATETIME(3) NULL, applied_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id), UNIQUE KEY uniq_tochukwu_seo_artifact_pid (pid_artifact),
      UNIQUE KEY uniq_tochukwu_seo_artifact_change (pid_change), KEY idx_tochukwu_seo_artifact_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_seo_pipeline_attempts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, pid_attempt VARCHAR(80) NOT NULL,
      pid_change VARCHAR(90) NOT NULL, stage VARCHAR(40) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'started', error_code VARCHAR(80) NULL,
      error_message TEXT NULL, details_json LONGTEXT NULL,
      started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), completed_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id), UNIQUE KEY uniq_tochukwu_seo_attempt_pid (pid_attempt),
      KEY idx_tochukwu_seo_attempt_change_stage (pid_change, stage), KEY idx_tochukwu_seo_attempt_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const now = new Date()
  const catalog = [
    ["SEOLINK_PROMPT_TO_PROFIT", "/courses/prompt-to-profit", "Prompt to Profit"],
    ["SEOLINK_PROMPT_TO_PRODUCTION", "/courses/prompt-to-production", "Prompt to Profit Advanced"],
    ["SEOLINK_BUILD_SERVICE", "/build", "Build Service"],
    ["SEOLINK_BUSINESS_PLAN", "/services/business-plan", "AI Business Plan Service"],
    ["SEOLINK_SCHOOLS", "/schools", "AI for Schools"],
    ["SEOLINK_COACHING", "/private-ai-build-coaching", "Private AI Build Coaching"],
    ["SEOLINK_RESOURCES", "/resources", "Resource Library"],
    ["SEOLINK_BLOG", "/blog", "Blog"]
  ]
  for (const [pidLink, url, label] of catalog) {
    await prisma.$executeRawUnsafe(
      `INSERT IGNORE INTO tochukwu_seo_linkable_pages (pid_link, url, normalized_url, label, status, source, approved_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', 'system', ?, ?, ?)`,
      pidLink, url, url, label, now, now, now
    )
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_search_console_query_stats (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      stat_uuid VARCHAR(80) NOT NULL,
      run_uuid VARCHAR(80) NOT NULL,
      page_url TEXT NOT NULL,
      blog_slug VARCHAR(255) NULL,
      query VARCHAR(500) NOT NULL,
      clicks INT NOT NULL DEFAULT 0,
      impressions INT NOT NULL DEFAULT 0,
      ctr DECIMAL(10,6) NOT NULL DEFAULT 0,
      position DECIMAL(10,4) NOT NULL DEFAULT 0,
      start_date DATE NULL,
      end_date DATE NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_sc_stat_uuid (stat_uuid),
      KEY idx_tochukwu_sc_stat_blog_slug (blog_slug),
      KEY idx_tochukwu_sc_stat_query (query),
      KEY idx_tochukwu_sc_stat_perf (impressions, position),
      KEY idx_tochukwu_sc_stat_run (run_uuid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_seo_opportunities (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      pid_opportunity VARCHAR(90) NOT NULL,
      page_url TEXT NOT NULL,
      blog_slug VARCHAR(255) NULL,
      pid_blog VARCHAR(64) NULL,
      opportunity_type VARCHAR(40) NOT NULL,
      primary_query VARCHAR(500) NULL,
      clicks INT NOT NULL DEFAULT 0,
      impressions INT NOT NULL DEFAULT 0,
      ctr DECIMAL(10,6) NOT NULL DEFAULT 0,
      position DECIMAL(10,4) NOT NULL DEFAULT 0,
      confidence DECIMAL(10,4) NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'open',
      recommendation TEXT NULL,
      recommended_cta VARCHAR(80) NULL,
      source_start_date DATE NULL,
      source_end_date DATE NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_seo_opp_pid (pid_opportunity),
      KEY idx_tochukwu_seo_opp_status (status, confidence),
      KEY idx_tochukwu_seo_opp_blog_slug (blog_slug),
      KEY idx_tochukwu_seo_opp_type (opportunity_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_seo_content_change_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      pid_change VARCHAR(90) NOT NULL,
      pid_opportunity VARCHAR(90) NULL,
      pid_blog VARCHAR(64) NULL,
      change_type VARCHAR(50) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'draft',
      before_json LONGTEXT NULL,
      after_json LONGTEXT NULL,
      validation_json LONGTEXT NULL,
      published_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_seo_change_pid (pid_change),
      KEY idx_tochukwu_seo_change_opp (pid_opportunity, created_at),
      KEY idx_tochukwu_seo_change_blog (pid_blog, created_at),
      KEY idx_tochukwu_seo_change_status (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await addColumnIfMissing("tochukwu_search_console_import_runs", "site_url", "VARCHAR(255) NOT NULL DEFAULT '' AFTER source")
  await addColumnIfMissing("tochukwu_search_console_import_runs", "dimensions", "VARCHAR(255) NOT NULL DEFAULT 'date,page,query,country,device' AFTER site_url")
  await addColumnIfMissing("tochukwu_search_console_query_stats", "date", "DATE NULL AFTER run_uuid")
  await addColumnIfMissing("tochukwu_search_console_query_stats", "dedupe_key", "CHAR(64) NULL AFTER stat_uuid")
  await addColumnIfMissing("tochukwu_search_console_query_stats", "site_url", "VARCHAR(255) NULL AFTER date")
  await addColumnIfMissing("tochukwu_search_console_query_stats", "country", "VARCHAR(20) NULL AFTER query")
  await addColumnIfMissing("tochukwu_search_console_query_stats", "device", "VARCHAR(40) NULL AFTER country")
  await addColumnIfMissing("tochukwu_seo_opportunities", "query_cluster", "LONGTEXT NULL AFTER primary_query")
  await prisma.$executeRawUnsafe(`ALTER TABLE tochukwu_search_console_query_stats MODIFY query VARCHAR(700) NOT NULL, MODIFY ctr DECIMAL(12,8) NOT NULL DEFAULT 0, MODIFY position DECIMAL(12,4) NOT NULL DEFAULT 0`)
  await prisma.$executeRawUnsafe(`ALTER TABLE tochukwu_seo_opportunities MODIFY primary_query VARCHAR(700) NULL, MODIFY ctr DECIMAL(12,8) NOT NULL DEFAULT 0, MODIFY position DECIMAL(12,4) NOT NULL DEFAULT 0`)
  const dedupeIndexes = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_search_console_query_stats' AND INDEX_NAME = 'uniq_tochukwu_sc_stat_dedupe'`)
  if (Number(dedupeIndexes[0]?.total || 0) === 0) {
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX uniq_tochukwu_sc_stat_dedupe ON tochukwu_search_console_query_stats (dedupe_key)`)
  }
  await prisma.$executeRawUnsafe(`
    UPDATE tochukwu_seo_opportunities AS opportunity
    INNER JOIN (
      SELECT ranked.id, ROW_NUMBER() OVER (
        PARTITION BY ranked.blog_slug
        ORDER BY CASE WHEN ranked.status = 'reviewing' THEN 0 ELSE 1 END,
          ranked.impressions DESC, ranked.updated_at DESC, ranked.id DESC
      ) AS duplicate_rank
      FROM tochukwu_seo_opportunities AS ranked
      WHERE ranked.blog_slug IS NOT NULL AND ranked.status IN ('open', 'reviewing')
    ) AS duplicate ON duplicate.id = opportunity.id
    SET opportunity.status = 'dismissed', opportunity.updated_at = CURRENT_TIMESTAMP
    WHERE duplicate.duplicate_rank > 1
  `)
  const opportunityIndexes = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tochukwu_seo_opportunities' AND INDEX_NAME = 'idx_tochukwu_seo_opp_blog_status'`)
  if (Number(opportunityIndexes[0]?.total || 0) === 0) {
    await prisma.$executeRawUnsafe(`CREATE INDEX idx_tochukwu_seo_opp_blog_status ON tochukwu_seo_opportunities (blog_slug, status)`)
  }

  console.log("tochukwu_seo_tables_ready")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

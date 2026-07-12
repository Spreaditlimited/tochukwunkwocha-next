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

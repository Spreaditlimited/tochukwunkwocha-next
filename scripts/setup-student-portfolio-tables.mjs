import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { PrismaClient } from "@prisma/client"

const directory = path.dirname(fileURLToPath(import.meta.url))
const migrationPaths = [
  path.join(directory, "..", "prisma", "migrations", "20260821120000_add_student_public_portfolios", "migration.sql")
]
const prisma = new PrismaClient()

try {
  for (const migrationPath of migrationPaths) {
    const sql = await fs.readFile(migrationPath, "utf8")
    const statements = sql.split(/;\s*(?:\n|$)/).map((statement) => statement.trim()).filter(Boolean)
    for (const statement of statements) await prisma.$executeRawUnsafe(statement)
  }
  const guardianColumns = await prisma.$queryRawUnsafe(`
    SELECT COLUMN_NAME AS columnName
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'student_public_profiles'
      AND COLUMN_NAME = 'guardian_consent_confirmed'
  `)
  if (!guardianColumns.length) {
    await prisma.$executeRawUnsafe("ALTER TABLE `student_public_profiles` ADD COLUMN `guardian_consent_confirmed` TINYINT(1) NOT NULL DEFAULT 0 AFTER `profile_picture_consent`")
  }
  const tables = await prisma.$queryRawUnsafe(`
    SELECT TABLE_NAME AS tableName
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('student_public_profiles', 'student_hire_enquiries')
    ORDER BY TABLE_NAME
  `)
  if (tables.length !== 2) throw new Error("Student portfolio tables were not created.")
  console.log(JSON.stringify({ ok: true, tables }, null, 2))
} finally {
  await prisma.$disconnect()
}

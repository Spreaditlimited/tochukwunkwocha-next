import { prisma } from "@/lib/prisma"

function assertIdentifier(value: string, label: string) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

export async function columnExists(tableName: string, columnName: string) {
  assertIdentifier(tableName, "table name")
  assertIdentifier(columnName, "column name")
  const rows = await prisma.$queryRaw<Array<{ found: bigint | number }>>`
    SELECT COUNT(*) AS found
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
      AND COLUMN_NAME = ${columnName}
  `
  return Number(rows[0]?.found || 0) > 0
}

export async function addColumnIfMissing(tableName: string, columnName: string, columnDefinition: string) {
  assertIdentifier(tableName, "table name")
  assertIdentifier(columnName, "column name")
  if (await columnExists(tableName, columnName)) return
  await prisma.$executeRawUnsafe(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`)
}

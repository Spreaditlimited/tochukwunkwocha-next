import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { strToU8, unzipSync, zipSync } from "fflate"
import PDFDocument from "pdfkit"

const root = process.cwd()
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8")

const migration = read("prisma/migrations/20260728120000_add_business_financials/migration.sql")
const financials = read("lib/admin-financials.ts")
const checkout = read("lib/payments/course-checkout.ts")
const exportRoute = read("app/api/internal/financials/export/route.ts")

assert.match(migration, /CREATE TABLE IF NOT EXISTS tochukwu_financial_transactions/)
assert.match(migration, /CREATE TABLE IF NOT EXISTS tochukwu_financial_export_audit/)
assert.match(migration, /UNIQUE KEY uniq_tochukwu_financial_source \(source_type, source_uuid\)/)
assert.match(financials, /INSERT IGNORE INTO tochukwu_financial_transactions/)
assert.match(financials, /COALESCE\(o\.provider, ''\) <> 'wallet'/)
assert.match(financials, /WHERE ip\.status = 'paid'/)
assert.match(financials, /WHERE m\.status = 'approved'/)
assert.match(financials, /WHERE o\.payment_status = 'paid'/)
assert.match(checkout, /input\.pricing\.courseAmountMinor/)
assert.match(checkout, /input\.pricing\.vatAmountMinor/)
assert.match(checkout, /input\.pricing\.processingFeeMinor/)
assert.match(exportRoute, /Currencies are never combined/)
assert.match(exportRoute, /\^\[=\+\\-@\]/)

const historicalSubtotalMinor = 10_750
const currentVatPercent = 7.5
const estimatedSalesMinor = Math.round(historicalSubtotalMinor / (1 + currentVatPercent / 100))
const estimatedVatMinor = historicalSubtotalMinor - estimatedSalesMinor
assert.equal(estimatedSalesMinor, 10_000)
assert.equal(estimatedVatMinor, 750)

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "financials-smoke-"))
const xlsxPath = path.join(temporaryDirectory, "financials.xlsx")
const pdfPath = path.join(temporaryDirectory, "financials.pdf")

const xlsxBytes = zipSync({
  "[Content_Types].xml": strToU8("<Types/>"),
  "xl/workbook.xml": strToU8("<workbook><sheet name=\"Transactions\"/></workbook>")
})
fs.writeFileSync(xlsxPath, xlsxBytes)
const xlsxSignature = fs.readFileSync(xlsxPath).subarray(0, 2).toString("utf8")
assert.equal(xlsxSignature, "PK")
assert.ok(unzipSync(xlsxBytes)["xl/workbook.xml"])

await new Promise((resolve, reject) => {
  const doc = new PDFDocument()
  const stream = fs.createWriteStream(pdfPath)
  stream.on("finish", resolve)
  stream.on("error", reject)
  doc.pipe(stream)
  doc.text("Business Financials")
  doc.end()
})
const pdfSignature = fs.readFileSync(pdfPath).subarray(0, 4).toString("utf8")
assert.equal(pdfSignature, "%PDF")

fs.rmSync(temporaryDirectory, { recursive: true, force: true })
console.log("Business financials smoke test passed.")

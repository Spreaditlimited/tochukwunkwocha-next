import { strToU8, zipSync } from "fflate"
import PDFDocument from "pdfkit"

import {
  formatFinancialMoney,
  listFinancialTransactions,
  parseFinancialFilters,
  recordFinancialExport,
  type FinancialTransaction
} from "@/lib/admin-financials"
import { requireAdmin } from "@/lib/auth"
import { formatDateTimeWAT } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function safeCell(value: unknown) {
  const text = String(value ?? "")
  return /^[=+\-@]/.test(text) ? `'${text}` : text
}

function periodLabel(filters: ReturnType<typeof parseFinancialFilters>) {
  if (filters.from && filters.to) return `${filters.from} to ${filters.to}`
  if (filters.from) return `From ${filters.from}`
  if (filters.to) return `Up to ${filters.to}`
  return "All time"
}

function filenameDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date())
}

function xml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function columnName(index: number) {
  let value = index + 1
  let out = ""
  while (value > 0) {
    value -= 1
    out = String.fromCharCode(65 + (value % 26)) + out
    value = Math.floor(value / 26)
  }
  return out
}

type XlsxCell = string | number

function worksheetXml(rows: XlsxCell[][], options: { moneyColumns?: number[]; autoFilter?: boolean } = {}) {
  const moneyColumns = new Set(options.moneyColumns || [])
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((cell, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowIndex + 1}`
      const style = rowIndex === 0 ? 1 : moneyColumns.has(columnIndex) ? 2 : 0
      if (typeof cell === "number" && Number.isFinite(cell)) {
        return `<c r="${reference}" s="${style}"><v>${cell}</v></c>`
      }
      return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(cell)}</t></is></c>`
    }).join("")
    return `<row r="${rowIndex + 1}">${cells}</row>`
  }).join("")
  const lastColumn = columnName(Math.max(0, (rows[0]?.length || 1) - 1))
  const filter = options.autoFilter && rows.length ? `<autoFilter ref="A1:${lastColumn}${rows.length}"/>` : ""
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <sheetData>${body}</sheetData>${filter}
</worksheet>`
}

function transactionRows(rows: FinancialTransaction[]) {
  return [
    ["Paid (WAT)", "Source", "Payment type", "Product", "Customer", "Email", "Reference", "Provider", "Currency", "Sales amount", "Discount", "VAT", "Processing fee", "Shipping", "Total collected", "Breakdown"],
    ...rows.map((row) => [
      formatDateTimeWAT(row.paidAt),
      safeCell(row.category === "shop" ? "Shop" : "Course"),
      safeCell(row.paymentType),
      safeCell(row.productLabel),
      safeCell(row.customerName),
      safeCell(row.customerEmail),
      safeCell(row.paymentReference),
      safeCell(row.provider),
      row.currency,
      row.salesAmountMinor / 100,
      row.discountMinor / 100,
      row.vatMinor / 100,
      row.processingFeeMinor / 100,
      row.shippingMinor / 100,
      row.totalCollectedMinor / 100,
      row.breakdownQuality
    ])
  ] satisfies XlsxCell[][]
}

async function excelBuffer(
  filters: ReturnType<typeof parseFinancialFilters>,
  data: Awaited<ReturnType<typeof listFinancialTransactions>>
) {
  const summaryRows: XlsxCell[][] = [
    ["Business Financials"],
    ["Reporting period", periodLabel(filters)],
    [],
    ["Currency", "Total collected", "Course revenue", "Shop revenue", "VAT", "Processing fees"],
    ...data.summary.map((item) => [
      item.currency,
      item.totalCollectedMinor / 100,
      item.courseRevenueMinor / 100,
      item.shopRevenueMinor / 100,
      item.vatMinor / 100,
      item.processingFeeMinor / 100
    ])
  ]
  const breakdownRows = (category: "course" | "shop"): XlsxCell[][] => [
    ["Paid (WAT)", "Product", "Customer", "Currency", "Collected", "Reference"],
    ...data.rows.filter((row) => row.category === category).map((row) => [
      formatDateTimeWAT(row.paidAt), safeCell(row.productLabel), safeCell(row.customerEmail || row.customerName),
      row.currency, row.totalCollectedMinor / 100, safeCell(row.paymentReference)
    ])
  ]
  const notesRows: XlsxCell[][] = [
    ["Term", "Meaning"],
    ["Exact", "The checkout saved the separate sales, VAT and processing-fee values at the time of payment."],
    ["Estimated", "An older course payment did not save separate VAT. VAT was calculated once using the current configured VAT rate when the financial ledger first recorded it."],
    ["Currencies", "Currencies are never combined. Compare each currency total separately."],
    ["Instalments", "Each successful instalment is recorded when paid. The later wallet enrolment record is excluded to prevent double counting."],
    ["Included records", "Only paid online orders, approved manual transfers, paid instalments and paid shop orders are included."]
  ]
  const sheets = [
    { name: "Summary", rows: summaryRows, money: [1, 2, 3, 4, 5] },
    { name: "Transactions", rows: transactionRows(data.rows), money: [9, 10, 11, 12, 13, 14] },
    { name: "Course Breakdown", rows: breakdownRows("course"), money: [4] },
    { name: "Shop Breakdown", rows: breakdownRows("shop"), money: [4] },
    { name: "Data Notes", rows: notesRows, money: [] }
  ]
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets>
</workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    "xl/styles.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B4F78"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`)
  }
  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheetXml(sheet.rows, { moneyColumns: sheet.money, autoFilter: index > 0 && index < 4 }))
  })
  return Buffer.from(zipSync(files, { level: 6 }))
}

function drawPdfHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.rect(0, 0, doc.page.width, 84).fill("#074b72")
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(18).text(title, 36, 24)
  doc.fillColor("#d7e8f2").font("Helvetica").fontSize(9).text(subtitle, 36, 51)
  doc.fillColor("#0f172a")
}

function addPdfPage(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.addPage({ size: "A4", layout: "landscape", margin: 36 })
  drawPdfHeader(doc, title, subtitle)
}

function drawPdfTableHeader(doc: PDFKit.PDFDocument, y: number) {
  doc.rect(36, y, 770, 22).fill("#e8f1f6")
  doc.fillColor("#28465a").font("Helvetica-Bold").fontSize(7)
  const columns = [
    ["Paid", 40, 90], ["Source", 132, 62], ["Product", 196, 137], ["Customer", 335, 126],
    ["Currency", 463, 47], ["VAT", 512, 66], ["Fee", 580, 66], ["Collected", 648, 90], ["Quality", 740, 62]
  ] as const
  columns.forEach(([label, x, width]) => doc.text(label, x, y + 7, { width }))
  return y + 26
}

function drawPdfRow(doc: PDFKit.PDFDocument, row: FinancialTransaction, y: number) {
  doc.fillColor("#263746").font("Helvetica").fontSize(6.8)
  doc.text(formatDateTimeWAT(row.paidAt).replace(" WAT", ""), 40, y, { width: 90, height: 22 })
  doc.text(row.category === "shop" ? "Shop" : row.paymentType, 132, y, { width: 62, height: 22 })
  doc.text(row.productLabel, 196, y, { width: 137, height: 22, ellipsis: true })
  doc.text(row.customerEmail || row.customerName || "—", 335, y, { width: 126, height: 22, ellipsis: true })
  doc.text(row.currency, 463, y, { width: 47 })
  doc.text((row.vatMinor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 }), 512, y, { width: 66 })
  doc.text((row.processingFeeMinor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 }), 580, y, { width: 66 })
  doc.font("Helvetica-Bold").text((row.totalCollectedMinor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 }), 648, y, { width: 90 })
  doc.font("Helvetica").text(row.breakdownQuality, 740, y, { width: 62 })
  doc.moveTo(36, y + 24).lineTo(806, y + 24).strokeColor("#dce4e9").lineWidth(0.5).stroke()
}

async function buildFinancialPdf(
  filters: ReturnType<typeof parseFinancialFilters>,
  data: Awaited<ReturnType<typeof listFinancialTransactions>>
) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, autoFirstPage: false, bufferPages: true })
    const chunks: Buffer[] = []
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
    doc.on("error", reject)
    doc.on("end", () => resolve(Buffer.concat(chunks)))

    addPdfPage(doc, "Business Financials", `${periodLabel(filters)} · Tochukwu Tech and AI Academy`)
    let y = 105
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text("Summary by currency", 36, y)
    y += 22
    data.summary.forEach((item) => {
      doc.roundedRect(36, y, 240, 62, 7).fillAndStroke("#f4f8fa", "#d8e3e9")
      doc.fillColor("#074b72").font("Helvetica-Bold").fontSize(11).text(item.currency, 49, y + 11)
      doc.fillColor("#0f172a").fontSize(14).text(formatFinancialMoney(item.currency, item.totalCollectedMinor), 49, y + 29)
      doc.fillColor("#64748b").font("Helvetica").fontSize(7).text(`${item.transactionCount} paid transactions`, 160, y + 14)
      doc.text(`VAT ${formatFinancialMoney(item.currency, item.vatMinor)}`, 160, y + 30)
      y += 72
      if (y > 480) {
        addPdfPage(doc, "Business Financials", `${periodLabel(filters)} · Summary continued`)
        y = 105
      }
    })

    addPdfPage(doc, "Transaction Ledger", `${periodLabel(filters)} · ${data.rows.length.toLocaleString("en-GB")} transactions`)
    y = drawPdfTableHeader(doc, 101)
    data.rows.forEach((row) => {
      if (y > 535) {
        addPdfPage(doc, "Transaction Ledger", `${periodLabel(filters)} · Continued`)
        y = drawPdfTableHeader(doc, 101)
      }
      drawPdfRow(doc, row, y)
      y += 25
    })
    if (!data.rows.length) {
      doc.fillColor("#64748b").font("Helvetica").fontSize(10).text("No paid transactions match these filters.", 36, y + 15)
    }

    const range = doc.bufferedPageRange()
    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index)
      doc.fillColor("#64748b").font("Helvetica").fontSize(7)
        .text(`www.tochukwunkwocha.com  ·  Page ${index + 1} of ${range.count}`, 36, 548, {
          width: 770,
          align: "center",
          lineBreak: false
        })
    }
    doc.end()
  })
}

export async function GET(request: Request) {
  const session = await requireAdmin("/internal/financials")
  const url = new URL(request.url)
  const raw = Object.fromEntries(url.searchParams.entries())
  const format = raw.format === "xlsx" ? "xlsx" : "pdf"
  const filters = parseFinancialFilters(raw)
  const data = await listFinancialTransactions(filters, true)
  const buffer = format === "xlsx" ? await excelBuffer(filters, data) : await buildFinancialPdf(filters, data)
  await recordFinancialExport({ adminUuid: session.adminUuid, format, filters, rowCount: data.rows.length })

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": format === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf",
      "Content-Disposition": `attachment; filename="business-financials-${filenameDate()}.${format}"`,
      "Cache-Control": "private, no-store"
    }
  })
}

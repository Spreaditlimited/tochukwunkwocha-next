import { v2 as cloudinary } from "cloudinary"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim()
const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim()
const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim()
if (!cloudName || !apiKey || !apiSecret) {
  throw new Error("CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are required.")
}
cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true })

const workbooks = [
  {
    sku: "PTP-WB01-DIG",
    slug: "expense-tracker",
    path: "deliverables/expense-tracker-workbook/Prompt-to-Profit-Workbook-01-Expense-Tracker.pdf",
    filename: "Prompt-to-Profit-Workbook-01-Expense-Tracker.pdf"
  },
  {
    sku: "PTP-WB02-DIG",
    slug: "customer-record-management-system",
    path: "deliverables/customer-record-management-system-workbook/Prompt-to-Profit-Workbook-02-Customer-Record-Management-System.pdf",
    filename: "Prompt-to-Profit-Workbook-02-Customer-Record-Management-System.pdf"
  },
  {
    sku: "PTP-WB03-DIG",
    slug: "professional-quotation-generator",
    path: "deliverables/professional-quotation-generator-workbook/Prompt-to-Profit-Workbook-03-Professional-Quotation-Generator.pdf",
    filename: "Prompt-to-Profit-Workbook-03-Professional-Quotation-Generator.pdf"
  },
  {
    sku: "PTP-WB04-DIG",
    slug: "professional-invoice-generator",
    path: "deliverables/professional-invoice-generator-workbook/Prompt-to-Profit-Workbook-04-Professional-Invoice-Generator.pdf",
    filename: "Prompt-to-Profit-Workbook-04-Professional-Invoice-Generator.pdf"
  },
  {
    sku: "PTP-WB05-DIG",
    slug: "appointment-booking-system",
    path: "deliverables/appointment-booking-system-workbook/Prompt-to-Profit-Workbook-05-Appointment-Booking-System.pdf",
    filename: "Prompt-to-Profit-Workbook-05-Appointment-Booking-System.pdf"
  },
  {
    sku: "PTP-WB06-DIG",
    slug: "sales-tracker",
    path: "deliverables/sales-tracker-workbook/Prompt-to-Profit-Workbook-06-Sales-Tracker.pdf",
    filename: "Prompt-to-Profit-Workbook-06-Sales-Tracker.pdf"
  },
  {
    sku: "PTP-WB07-DIG",
    slug: "supplier-management-system",
    path: "deliverables/supplier-management-system-workbook/Prompt-to-Profit-Workbook-07-Supplier-Management-System.pdf",
    filename: "Prompt-to-Profit-Workbook-07-Supplier-Management-System.pdf"
  },
  {
    sku: "PTP-WB08-DIG",
    slug: "order-management-system",
    path: "deliverables/order-management-system-workbook/Prompt-to-Profit-Workbook-08-Order-Management-System.pdf",
    filename: "Prompt-to-Profit-Workbook-08-Order-Management-System.pdf"
  }
]

const requestedSkus = new Set(
  String(process.env.SHOP_WORKBOOK_SKUS || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
)
const selectedWorkbooks = requestedSkus.size
  ? workbooks.filter((workbook) => requestedSkus.has(workbook.sku))
  : workbooks
if (requestedSkus.size !== selectedWorkbooks.length) {
  throw new Error("SHOP_WORKBOOK_SKUS contains an unknown or duplicate workbook SKU.")
}

async function verifyProtectedAsset(asset) {
  const expiresAt = Math.floor(Date.now() / 1000) + 120
  const signedUrl = cloudinary.utils.private_download_url(asset.public_id, asset.format || "pdf", {
    resource_type: "raw",
    type: "authenticated",
    attachment: true,
    expires_at: expiresAt
  })
  const signedResponse = await fetch(signedUrl)
  if (!signedResponse.ok) {
    throw new Error(`Signed delivery failed with HTTP ${signedResponse.status}.`)
  }
  const reader = signedResponse.body?.getReader()
  const firstChunk = reader ? await reader.read() : null
  await reader?.cancel()
  const header = firstChunk?.value
    ? Buffer.from(firstChunk.value).subarray(0, 5).toString("ascii")
    : ""
  if (header !== "%PDF-") throw new Error("Signed delivery did not return a PDF file.")

  const unsignedUrl = `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/raw/authenticated/${asset.public_id}.${asset.format || "pdf"}`
  const unsignedResponse = await fetch(unsignedUrl, { redirect: "manual" })
  await unsignedResponse.body?.cancel()
  if (unsignedResponse.ok) {
    throw new Error("The authenticated asset unexpectedly responded through an unsigned URL.")
  }
}

try {
  for (const workbook of selectedWorkbooks) {
    const publicId = `tochukwu-shop/workbooks/${workbook.slug}`
    process.stdout.write(`Uploading ${workbook.sku}... `)
    const result = await cloudinary.uploader.upload(workbook.path, {
      public_id: publicId,
      resource_type: "raw",
      type: "authenticated",
      overwrite: true,
      invalidate: true,
      use_filename: false,
      unique_filename: false
    })
    if (result.resource_type !== "raw" || result.type !== "authenticated") {
      throw new Error(`${workbook.sku} was not stored as an authenticated raw asset.`)
    }
    await verifyProtectedAsset({ ...result, filename: workbook.filename })
    await prisma.shopProductVariant.update({
      where: { sku: workbook.sku },
      data: {
        digitalAssetKey: null,
        digitalFilename: workbook.filename,
        cloudinaryPublicId: result.public_id,
        cloudinaryResourceType: result.resource_type,
        cloudinaryDeliveryType: result.type,
        cloudinaryFormat: String(result.format || "pdf"),
        cloudinaryVersion: String(result.version || ""),
        cloudinaryBytes: Number(result.bytes || 0),
        updatedAt: new Date()
      }
    })
    console.log(`protected and verified (${Number(result.bytes || 0)} bytes)`)
  }
} finally {
  await prisma.$disconnect()
}

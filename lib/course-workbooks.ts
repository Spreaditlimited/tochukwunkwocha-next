import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { watWallDateTimeMs } from "@/lib/utils"

export const PROMPT_TO_PROFIT_WORKBOOK_COURSE_SLUGS = [
  "prompt-to-profit",
  "prompt-to-profit-holiday"
] as const

export const INCLUDED_PROMPT_TO_PROFIT_WORKBOOKS = [
  {
    number: "01",
    sku: "PTP-WB01-DIG",
    slug: "expense-tracker-workbook",
    title: "Expense Tracker",
    description: "Build a secure application for recording expenses, calculating totals, and understanding spending.",
    coverImageUrl: "/shop/workbooks/expense-tracker-cover.png"
  },
  {
    number: "02",
    sku: "PTP-WB02-DIG",
    slug: "customer-record-management-system-workbook",
    title: "Customer Record Management System",
    description: "Create a practical system for organising, updating, and securely managing customer information.",
    coverImageUrl: "/shop/workbooks/customer-record-management-system-cover.png"
  },
  {
    number: "03",
    sku: "PTP-WB03-DIG",
    slug: "professional-quotation-generator-workbook",
    title: "Professional Quotation Generator",
    description: "Develop a business tool for creating, saving, editing, and printing professional quotations.",
    coverImageUrl: "/shop/workbooks/professional-quotation-generator-cover.png"
  },
  {
    number: "04",
    sku: "PTP-WB04-DIG",
    slug: "professional-invoice-generator-workbook",
    title: "Professional Invoice Generator",
    description: "Build a secure application that calculates, stores, and prints professional business invoices.",
    coverImageUrl: "/shop/workbooks/professional-invoice-generator-cover.png"
  },
  {
    number: "05",
    sku: "PTP-WB05-DIG",
    slug: "appointment-booking-system-workbook",
    title: "Appointment Booking System",
    description: "Create a complete booking workflow that helps a business receive and manage appointments.",
    coverImageUrl: "/shop/workbooks/appointment-booking-system-cover.png"
  }
] as const

type CourseWorkbookAccount = {
  accountId: bigint
  email: string
}

export async function hasIncludedPromptToProfitWorkbooks(input: CourseWorkbookAccount) {
  const access = await getPromptToProfitWorkbookAccess(input)
  return access.enrolled && access.batchStarted
}

export async function getPromptToProfitWorkbookAccess(input: CourseWorkbookAccount) {
  const normalizedEmail = String(input.email || "").trim().toLowerCase().slice(0, 190)
  if (!normalizedEmail) {
    return { enrolled: false, batchStarted: false, batchStartAt: null as Date | null }
  }

  const rows = await prisma.$queryRaw<Array<{ batchStartAt: Date | null }>>(Prisma.sql`
    SELECT access_rows.batchStartAt
    FROM (
      SELECT b.batch_start_at AS batchStartAt, o.created_at AS grantedAt
      FROM course_orders o
      JOIN course_batches b
        ON b.course_slug COLLATE utf8mb4_general_ci = o.course_slug COLLATE utf8mb4_general_ci
       AND b.batch_key COLLATE utf8mb4_general_ci = o.batch_key COLLATE utf8mb4_general_ci
      WHERE o.email COLLATE utf8mb4_general_ci = ${normalizedEmail}
        AND o.course_slug IN (${Prisma.join(PROMPT_TO_PROFIT_WORKBOOK_COURSE_SLUGS)})
        AND COALESCE(o.buyer_type, 'student') <> 'family'
        AND LOWER(COALESCE(o.status, '')) IN ('paid', 'approved', 'success', 'completed')

      UNION ALL

      SELECT b.batch_start_at AS batchStartAt, m.created_at AS grantedAt
      FROM course_manual_payments m
      JOIN course_batches b
        ON b.course_slug COLLATE utf8mb4_general_ci = m.course_slug COLLATE utf8mb4_general_ci
       AND b.batch_key COLLATE utf8mb4_general_ci = m.batch_key COLLATE utf8mb4_general_ci
      WHERE m.email COLLATE utf8mb4_general_ci = ${normalizedEmail}
        AND m.course_slug IN (${Prisma.join(PROMPT_TO_PROFIT_WORKBOOK_COURSE_SLUGS)})
        AND COALESCE(m.buyer_type, 'student') <> 'family'
        AND LOWER(COALESCE(m.status, '')) IN ('paid', 'approved', 'success', 'completed')

      UNION ALL

      SELECT b.batch_start_at AS batchStartAt, COALESCE(e.paid_at, e.updated_at, e.created_at) AS grantedAt
      FROM family_children c
      JOIN family_accounts f ON f.id = c.family_id
      JOIN family_child_enrollments e ON e.child_id = c.id
      JOIN course_batches b
        ON b.course_slug COLLATE utf8mb4_general_ci = e.course_slug COLLATE utf8mb4_general_ci
       AND b.batch_key COLLATE utf8mb4_general_ci = e.batch_key COLLATE utf8mb4_general_ci
      WHERE c.account_id = ${input.accountId}
        AND c.status = 'active'
        AND f.status = 'active'
        AND e.status = 'active'
        AND e.course_slug IN (${Prisma.join(PROMPT_TO_PROFIT_WORKBOOK_COURSE_SLUGS)})
    ) access_rows
    ORDER BY access_rows.grantedAt DESC
  `).catch(() => [])

  const nowMs = Date.now()
  const validStarts = rows
    .map((row) => ({ value: row.batchStartAt, ms: watWallDateTimeMs(row.batchStartAt) }))
    .filter((row) => Number.isFinite(row.ms))
  const started = validStarts.some((row) => row.ms <= nowMs)
  const nextStart = validStarts
    .filter((row) => row.ms > nowMs)
    .sort((left, right) => left.ms - right.ms)[0]?.value || null

  return {
    enrolled: rows.length > 0,
    batchStarted: started,
    batchStartAt: nextStart
  }
}

export async function listIncludedPromptToProfitWorkbooks(input: CourseWorkbookAccount) {
  const access = await getPromptToProfitWorkbookAccess(input)
  if (!access.enrolled) return []

  const variants = await prisma.shopProductVariant.findMany({
    where: {
      sku: { in: INCLUDED_PROMPT_TO_PROFIT_WORKBOOKS.map((workbook) => workbook.sku) },
      active: true,
      fulfillmentType: "digital"
    },
    select: {
      sku: true,
      digitalAssetKey: true,
      cloudinaryPublicId: true
    }
  }).catch(() => [])
  const downloadableSkus = new Set(
    variants
      .filter((variant) => Boolean(variant.cloudinaryPublicId || variant.digitalAssetKey))
      .map((variant) => variant.sku)
  )

  return INCLUDED_PROMPT_TO_PROFIT_WORKBOOKS.map((workbook) => ({
    ...workbook,
    available: access.batchStarted && downloadableSkus.has(workbook.sku),
    batchStarted: access.batchStarted,
    batchStartAt: access.batchStartAt,
    downloadHref: `/api/student/course-workbooks/${encodeURIComponent(workbook.sku)}`
  }))
}

export async function getIncludedPromptToProfitWorkbook(input: CourseWorkbookAccount & { sku: string }) {
  const access = await getPromptToProfitWorkbookAccess(input)
  if (!access.enrolled || !access.batchStarted) return { access, workbook: null }

  const normalizedSku = String(input.sku || "").trim().toUpperCase()
  if (!INCLUDED_PROMPT_TO_PROFIT_WORKBOOKS.some((workbook) => workbook.sku === normalizedSku)) {
    return { access, workbook: null }
  }

  const workbook = await prisma.shopProductVariant.findFirst({
    where: {
      sku: normalizedSku,
      active: true,
      fulfillmentType: "digital"
    },
    select: {
      sku: true,
      digitalAssetKey: true,
      digitalFilename: true,
      cloudinaryPublicId: true,
      cloudinaryResourceType: true,
      cloudinaryDeliveryType: true,
      cloudinaryFormat: true
    }
  })
  return { access, workbook }
}

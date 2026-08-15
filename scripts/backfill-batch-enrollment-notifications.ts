import { prisma } from "../lib/prisma"
import {
  enqueueEnrollmentConfirmationNotification,
  processPaymentNotificationOutbox
} from "../lib/payment-notification-outbox"

type EnrollmentRow = {
  sourceType: "course_order" | "manual_payment"
  sourceUuid: string
  email: string
  fullName: string | null
  phone: string | null
  buyerType: string | null
  courseSlug: string
  batchKey: string
  batchLabel: string | null
  enrolledAt: Date
  finalEmailSent: number | bigint
}

const args = new Set(process.argv.slice(2))
const shouldSend = args.has("--send")
const courseSlug = "prompt-to-profit-holiday"
const batchKey = "ptph-batch-4"
const brevoListId = 14

async function main() {
  const [cardRows, manualRows] = await Promise.all([
    prisma.$queryRaw<EnrollmentRow[]>`
    SELECT 'course_order' AS sourceType, o.order_uuid AS sourceUuid,
           LOWER(TRIM(o.email)) AS email, o.first_name AS fullName, o.phone,
           o.buyer_type AS buyerType, o.course_slug AS courseSlug,
           o.batch_key AS batchKey, o.batch_label AS batchLabel,
           COALESCE(o.paid_at, o.updated_at, o.created_at) AS enrolledAt,
           EXISTS(
             SELECT 1 FROM tochukwu_email_delivery_log l
             WHERE LOWER(l.recipient) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(o.email)) COLLATE utf8mb4_unicode_ci
               AND l.subject COLLATE utf8mb4_unicode_ci = 'Your Tochukwu Tech learning account is ready' COLLATE utf8mb4_unicode_ci
               AND l.status = 'sent'
               AND l.attempted_at >= DATE_SUB(COALESCE(o.paid_at, o.updated_at, o.created_at), INTERVAL 5 MINUTE)
           ) AS finalEmailSent
    FROM course_orders o
    WHERE o.status = 'paid' AND o.course_slug = ${courseSlug} AND o.batch_key = ${batchKey}
      AND COALESCE(TRIM(o.email), '') <> ''
    ORDER BY enrolledAt ASC
    `,
    prisma.$queryRaw<EnrollmentRow[]>`
    SELECT 'manual_payment' AS sourceType, m.payment_uuid AS sourceUuid,
           LOWER(TRIM(m.email)) AS email, m.first_name AS fullName, m.phone,
           m.buyer_type AS buyerType, m.course_slug AS courseSlug,
           m.batch_key AS batchKey, m.batch_label AS batchLabel,
           COALESCE(m.reviewed_at, m.updated_at, m.created_at) AS enrolledAt,
           EXISTS(
             SELECT 1 FROM tochukwu_email_delivery_log l
             WHERE LOWER(l.recipient) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(m.email)) COLLATE utf8mb4_unicode_ci
               AND l.subject COLLATE utf8mb4_unicode_ci = 'Your Tochukwu Tech learning account is ready' COLLATE utf8mb4_unicode_ci
               AND l.status = 'sent'
               AND l.attempted_at >= DATE_SUB(COALESCE(m.reviewed_at, m.updated_at, m.created_at), INTERVAL 5 MINUTE)
           ) AS finalEmailSent
    FROM course_manual_payments m
    WHERE m.status = 'approved' AND m.course_slug = ${courseSlug} AND m.batch_key = ${batchKey}
      AND COALESCE(TRIM(m.email), '') <> ''
    ORDER BY enrolledAt ASC
    `
  ])
  const rows = [...cardRows, ...manualRows].sort((a, b) => a.enrolledAt.getTime() - b.enrolledAt.getTime())

  const missingEmail = rows.filter((row) => !Number(row.finalEmailSent)).length
  const missingPhone = rows.filter((row) => !String(row.phone || "").trim()).length
  console.log(JSON.stringify({
    mode: shouldSend ? "send" : "dry-run",
    courseSlug,
    batchKey,
    brevoListId,
    enrollments: rows.length,
    finalEmailAlreadyRecorded: rows.length - missingEmail,
    finalEmailToSend: missingEmail,
    whatsappToSubmit: rows.length - missingPhone,
    whatsappSkippedMissingPhone: missingPhone,
    brevoContactsToUpsert: rows.length
  }, null, 2))

  if (!shouldSend) return

  let completed = 0
  let retrying = 0
  for (const row of rows) {
    const hasPhone = Boolean(String(row.phone || "").trim())
    const eventUuid = await enqueueEnrollmentConfirmationNotification({
      sourceType: "backfill",
      sourceUuid: `${row.sourceType}:${row.sourceUuid}:batch4-confirmation-v1`,
      email: row.email,
      fullName: String(row.fullName || "Student"),
      phone: String(row.phone || ""),
      courseSlug: row.courseSlug,
      batchKey: row.batchKey,
      batchLabel: String(row.batchLabel || "Batch 4"),
      dashboardPath: String(row.buyerType || "").toLowerCase() === "family" ? "/dashboard/family" : "/dashboard/courses",
      brevoListId,
      syncBrevo: true,
      sendEmail: !Number(row.finalEmailSent),
      sendWhatsApp: hasPhone
    })
    const result = await processPaymentNotificationOutbox({ eventUuid })
    completed += result.completed
    retrying += result.failed
  }

  const summary = await prisma.$queryRaw<Array<{
    status: string
    total: number | bigint
    brevoSent: number | bigint
    emailSent: number | bigint
    emailSkipped: number | bigint
    whatsappSent: number | bigint
    whatsappSkipped: number | bigint
  }>>`
    SELECT status, COUNT(*) AS total,
           SUM(brevo_status = 'sent') AS brevoSent,
           SUM(email_status = 'sent') AS emailSent,
           SUM(email_status = 'skipped') AS emailSkipped,
           SUM(whatsapp_status = 'sent') AS whatsappSent,
           SUM(whatsapp_status = 'skipped') AS whatsappSkipped
    FROM tochukwu_notification_outbox
    WHERE event_type = 'enrollment_confirmed'
      AND source_uuid LIKE '%:batch4-confirmation-v1'
    GROUP BY status
    ORDER BY status
  `
  console.log(JSON.stringify({
    attempted: rows.length,
    completed,
    retrying,
    ledger: summary.map((row) => ({
      status: row.status,
      total: Number(row.total),
      brevoSent: Number(row.brevoSent),
      emailSent: Number(row.emailSent),
      emailSkipped: Number(row.emailSkipped),
      whatsappSent: Number(row.whatsappSent),
      whatsappSkipped: Number(row.whatsappSkipped)
    }))
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())

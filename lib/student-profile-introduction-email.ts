import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { sendBrevoTransactionalEmail } from "@/lib/brevo-transactional"
import { normalizeDeliverableEmail } from "@/lib/email-address"
import { prisma } from "@/lib/prisma"
import { publicAbsoluteUrl } from "@/lib/public-site-url"

export const STUDENT_PROFILE_INTRODUCTION_CAMPAIGN_KEY = "profile-public-portfolio-v2"
export const STUDENT_PROFILE_INTRODUCTION_SUBJECT = "Action required: Complete your profile for certificates and your public portfolio"

export type ProfileIntroductionRecipient = {
  accountId: bigint
  fullName: string
  email: string
  ageBand: string | null
  isYoungOrManaged: boolean
  deliveryStatus: string
  attempts: number
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function firstName(value: unknown) {
  return clean(value, 180).split(/\s+/).filter(Boolean)[0] || "Learner"
}

export function buildStudentProfileIntroductionEmail(input: { fullName: string }) {
  const name = firstName(input.fullName)
  const profileUrl = publicAbsoluteUrl("/dashboard/profile")
  const subject = STUDENT_PROFILE_INTRODUCTION_SUBJECT
  const text = `Hello ${name},

Please complete your learner profile in the Tochukwu Tech and AI Academy dashboard. Accurate information helps us support you properly, issue certificates in the correct name and prepare your professional public portfolio.

Please check:
• The learner's correct full name
• Country and region
• Age band and learner category
• Profile photograph
• Contact and WhatsApp preferences

After an eligible project is approved and a certificate is issued, the learner can create a moderated public portfolio showcasing their skills, project and learning journey.

Eligible adult learners may also choose to receive professional opportunities through a protected enquiry form. Their email address and phone number will not be displayed publicly.

This is why the Age Band field is important. Select the learner's actual age band, even if a parent enrolled the child using a separate email address. Learners marked Under 13 or 13–17 are automatically classified as Young Learners. Their profiles require responsible-adult consent, and the professional-enquiry feature is not available to them.

Every public profile requires the learner's consent and Academy approval. Login email, phone number, exact age, gender and other private account information are never published.

Complete your learner profile:
${profileUrl}

If the learner is under 18, a parent or guardian should help complete and review the profile.

Kind regards,
Learning Support
Tochukwu Tech and AI Academy`

  const html = `
    <p style="margin:0 0 16px;">Hello <strong>${escapeHtml(name)}</strong>,</p>
    <p style="margin:0 0 16px;">Please complete your learner profile in the Tochukwu Tech and AI Academy dashboard. Accurate information helps us support you properly, issue certificates in the correct name and prepare your professional public portfolio.</p>
    <p style="margin:20px 0 8px;font-size:17px;font-weight:800;color:#06162d;">Please check:</p>
    <ul style="margin:0 0 20px;padding-left:22px;">
      <li>The learner's correct full name</li>
      <li>Country and region</li>
      <li>Age band and learner category</li>
      <li>Profile photograph</li>
      <li>Contact and WhatsApp preferences</li>
    </ul>
    <div style="margin:22px 0;border:1px solid #dbe7f3;border-radius:12px;background:#f8fbff;padding:18px;">
      <p style="margin:0 0 10px;font-size:17px;font-weight:800;color:#06162d;">Your public project portfolio</p>
      <p style="margin:0 0 10px;">After an eligible project is approved and a certificate is issued, the learner can create a moderated public portfolio showcasing their skills, project and learning journey.</p>
      <p style="margin:0;">Eligible adult learners may also choose to receive professional opportunities through a protected enquiry form. Their email address and phone number will not be displayed publicly.</p>
    </div>
    <p style="margin:0 0 16px;"><strong>This is why the Age Band field is important.</strong> Select the learner's actual age band, even if a parent enrolled the child using a separate email address. Learners marked <strong>Under 13</strong> or <strong>13–17</strong> are automatically classified as Young Learners. Their profiles require responsible-adult consent, and the professional-enquiry feature is not available to them.</p>
    <p style="margin:0 0 16px;">Every public profile requires the learner's consent and Academy approval. Login email, phone number, exact age, gender and other private account information are never published.</p>
    <p style="margin:24px 0;"><a href="${profileUrl}" style="display:inline-block;border-radius:10px;background:#0d4f9a;color:#ffffff;padding:13px 20px;font-weight:800;text-decoration:none;">Complete your learner profile</a></p>
    <p style="margin:0 0 16px;">If the learner is under 18, a parent or guardian should help complete and review the profile.</p>
    <p style="margin:0;">Kind regards,<br/><strong>Learning Support</strong><br/>Tochukwu Tech and AI Academy</p>
  `
  return { subject, text, html }
}

export async function ensureStudentProfileIntroductionDeliveryTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_student_profile_email_deliveries (
      id BIGINT NOT NULL AUTO_INCREMENT,
      delivery_uuid VARCHAR(64) NOT NULL,
      campaign_key VARCHAR(80) NOT NULL,
      account_id BIGINT NOT NULL,
      recipient_email VARCHAR(320) NOT NULL,
      recipient_name VARCHAR(180) NULL,
      subject VARCHAR(255) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      attempts INT NOT NULL DEFAULT 0,
      provider VARCHAR(40) NOT NULL DEFAULT 'brevo',
      provider_message_id VARCHAR(500) NULL,
      last_error VARCHAR(1000) NULL,
      last_attempt_at DATETIME NULL,
      sent_at DATETIME NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_student_profile_email_uuid (delivery_uuid),
      UNIQUE KEY uniq_student_profile_email_campaign_account (campaign_key, account_id),
      KEY idx_student_profile_email_status (campaign_key, status, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

export async function listStudentProfileIntroductionRecipients(): Promise<ProfileIntroductionRecipient[]> {
  await ensureStudentProfileIntroductionDeliveryTable()
  const rows = await prisma.$queryRaw<Array<{
    accountId: bigint
    fullName: string
    email: string
    ageBand: string | null
    managedOrYoung: number | bigint | boolean
    deliveryStatus: string | null
    attempts: number | bigint | null
  }>>(Prisma.sql`
    SELECT sa.id AS accountId, sa.full_name AS fullName, sa.email, sa.age_band AS ageBand,
      CASE WHEN LOWER(TRIM(COALESCE(sa.age_band, ''))) IN ('under-13', '13-17')
        OR EXISTS (
          SELECT 1 FROM family_child_enrollments enrollment
          JOIN family_children child ON child.id = enrollment.child_id
          JOIN family_accounts family ON family.id = enrollment.family_id
          WHERE child.account_id = sa.id AND child.status = 'active'
            AND family.status = 'active' AND enrollment.status = 'active'
        )
        OR EXISTS (SELECT 1 FROM school_students student WHERE student.account_id = sa.id AND student.status = 'active')
        THEN 1 ELSE 0 END AS managedOrYoung,
      delivery.status AS deliveryStatus, delivery.attempts
    FROM student_accounts sa
    LEFT JOIN tochukwu_student_profile_email_deliveries delivery
      ON delivery.campaign_key = ${STUDENT_PROFILE_INTRODUCTION_CAMPAIGN_KEY}
     AND delivery.account_id = sa.id
    WHERE COALESCE(TRIM(sa.email), '') <> ''
      AND LOWER(sa.email) NOT LIKE '%@student-code.local'
      AND (
        EXISTS (
          SELECT 1 FROM course_orders enrollment
          WHERE LOWER(enrollment.email) = LOWER(sa.email)
            AND COALESCE(enrollment.buyer_type, 'student') <> 'family'
            AND LOWER(COALESCE(enrollment.status, '')) IN ('paid', 'success', 'completed')
        )
        OR EXISTS (
          SELECT 1 FROM course_manual_payments enrollment
          WHERE LOWER(enrollment.email) = LOWER(sa.email)
            AND COALESCE(enrollment.buyer_type, 'student') <> 'family'
            AND LOWER(COALESCE(enrollment.status, '')) IN ('approved', 'paid', 'success', 'completed')
        )
        OR EXISTS (
          SELECT 1 FROM family_child_enrollments enrollment
          JOIN family_children child ON child.id = enrollment.child_id
          JOIN family_accounts family ON family.id = enrollment.family_id
          WHERE child.account_id = sa.id AND child.status = 'active'
            AND family.status = 'active' AND enrollment.status = 'active'
        )
        OR EXISTS (
          SELECT 1 FROM school_students student
          WHERE student.account_id = sa.id AND student.status = 'active'
        )
      )
    ORDER BY sa.id ASC
  `)

  return rows
    .map((row) => ({
      accountId: row.accountId,
      email: normalizeDeliverableEmail(row.email, 190),
      fullName: clean(row.fullName, 180),
      ageBand: clean(row.ageBand, 40) || null,
      isYoungOrManaged: Number(row.managedOrYoung || 0) === 1,
      deliveryStatus: clean(row.deliveryStatus, 32) || "not_started",
      attempts: Number(row.attempts || 0)
    }))
    .filter((row) => row.email)
}

export async function claimStudentProfileIntroductionDelivery(recipient: ProfileIntroductionRecipient) {
  const now = new Date()
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO tochukwu_student_profile_email_deliveries
        (delivery_uuid, campaign_key, account_id, recipient_email, recipient_name, subject,
         status, attempts, provider, created_at, updated_at)
      VALUES (${`spm_${crypto.randomUUID().replace(/-/g, "")}`}, ${STUDENT_PROFILE_INTRODUCTION_CAMPAIGN_KEY},
        ${recipient.accountId}, ${recipient.email}, ${recipient.fullName}, ${STUDENT_PROFILE_INTRODUCTION_SUBJECT},
        'pending', 0, 'brevo', ${now}, ${now})
      ON DUPLICATE KEY UPDATE recipient_email = VALUES(recipient_email), recipient_name = VALUES(recipient_name),
        subject = VALUES(subject), updated_at = VALUES(updated_at)
    `
    const rows = await tx.$queryRaw<Array<{ status: string; attempts: number | bigint; lastAttemptAt: Date | null }>>(Prisma.sql`
      SELECT status, attempts, last_attempt_at AS lastAttemptAt
      FROM tochukwu_student_profile_email_deliveries
      WHERE campaign_key = ${STUDENT_PROFILE_INTRODUCTION_CAMPAIGN_KEY}
        AND account_id = ${recipient.accountId}
      LIMIT 1 FOR UPDATE
    `)
    const row = rows[0]
    const status = clean(row?.status, 32)
    const attempts = Number(row?.attempts || 0)
    if (status === "sent" || attempts >= 5) return false
    if (status === "processing" && row?.lastAttemptAt && now.getTime() - row.lastAttemptAt.getTime() < 20 * 60_000) return false
    await tx.$executeRaw`
      UPDATE tochukwu_student_profile_email_deliveries
      SET status = 'processing', attempts = ${attempts + 1}, last_attempt_at = ${now},
        last_error = NULL, updated_at = ${now}
      WHERE campaign_key = ${STUDENT_PROFILE_INTRODUCTION_CAMPAIGN_KEY}
        AND account_id = ${recipient.accountId}
    `
    return true
  })
}

export async function finishStudentProfileIntroductionDelivery(input: {
  accountId: bigint
  status: "sent" | "failed"
  messageId?: string | null
  error?: unknown
}) {
  const now = new Date()
  const error = input.error instanceof Error ? input.error.message : clean(input.error, 1000)
  await prisma.$executeRaw`
    UPDATE tochukwu_student_profile_email_deliveries
    SET status = ${input.status}, provider_message_id = ${clean(input.messageId, 500) || null},
      last_error = ${clean(error, 1000) || null}, sent_at = ${input.status === "sent" ? now : null}, updated_at = ${now}
    WHERE campaign_key = ${STUDENT_PROFILE_INTRODUCTION_CAMPAIGN_KEY}
      AND account_id = ${input.accountId}
  `
}

export async function sendStudentProfileIntroductionEmail(recipient: ProfileIntroductionRecipient) {
  const email = buildStudentProfileIntroductionEmail({ fullName: recipient.fullName })
  let lastError: unknown = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await sendBrevoTransactionalEmail({
        to: recipient.email,
        name: recipient.fullName,
        ...email,
        tags: [STUDENT_PROFILE_INTRODUCTION_CAMPAIGN_KEY],
        headers: { "X-Profile-Campaign": STUDENT_PROFILE_INTRODUCTION_CAMPAIGN_KEY }
      })
    } catch (error) {
      lastError = error
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_500))
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Brevo could not send the profile introduction email.")
}

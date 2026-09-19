import crypto from "node:crypto"

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const apiKey = String(process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || "").trim()
const apply = process.argv.includes("--apply")
const pauseBrevo = process.argv.includes("--pause-brevo")
const resumeBrevo = process.argv.includes("--resume-brevo")
const listId = 17
const templateIds = Array.from({ length: 12 }, (_, index) => 65 + index)
const now = new Date()
const startDate = "2026-06-24"
const endDate = now.toISOString().slice(0, 10)

if (!apiKey) throw new Error("Missing BREVO_API_KEY.")
if ((pauseBrevo || resumeBrevo) && !apply) throw new Error("Brevo template status changes require --apply.")
if (pauseBrevo && resumeBrevo) throw new Error("Choose either --pause-brevo or --resume-brevo.")

function clean(value, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

function normalizeEmail(value) {
  const email = clean(value, 320).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}

function emailKey(email) {
  return crypto.createHash("sha256").update(email).digest("hex")
}

async function brevoJson(url, init) {
  const response = await fetch(url, {
    ...init,
    headers: { "api-key": apiKey, accept: "application/json", "content-type": "application/json", ...(init?.headers || {}) },
    signal: AbortSignal.timeout(20_000)
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.message || `Brevo request failed (${response.status}).`)
  return body
}

async function listContacts() {
  const contacts = new Map()
  let offset = 0
  while (true) {
    const url = new URL(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts`)
    url.searchParams.set("limit", "500")
    url.searchParams.set("offset", String(offset))
    url.searchParams.set("sort", "desc")
    const body = await brevoJson(url)
    const batch = Array.isArray(body?.contacts) ? body.contacts : []
    for (const contact of batch) {
      const email = normalizeEmail(contact?.email)
      if (!email || contact?.emailBlacklisted) continue
      contacts.set(email, clean(contact?.attributes?.FIRSTNAME || contact?.attributes?.PRENOM, 180) || "there")
    }
    if (batch.length < 500) break
    offset += batch.length
  }
  return contacts
}

async function deliveredHistory() {
  const byEmail = new Map()
  for (let week = 1; week <= templateIds.length; week += 1) {
    const url = new URL("https://api.brevo.com/v3/smtp/statistics/events")
    url.searchParams.set("limit", "5000")
    url.searchParams.set("startDate", startDate)
    url.searchParams.set("endDate", endDate)
    url.searchParams.set("templateId", String(templateIds[week - 1]))
    url.searchParams.set("event", "delivered")
    const body = await brevoJson(url)
    for (const event of body?.events || []) {
      if (event?.event !== "delivered" || Number(event?.templateId) !== templateIds[week - 1]) continue
      const email = normalizeEmail(event?.email)
      const deliveredAt = new Date(event?.date || 0)
      if (!email || !Number.isFinite(deliveredAt.getTime())) continue
      const current = byEmail.get(email) || { weeks: new Map(), highestWeek: 0, lastDeliveredAt: null }
      const existing = current.weeks.get(week)
      if (!existing || deliveredAt > existing) current.weeks.set(week, deliveredAt)
      if (week > current.highestWeek || (week === current.highestWeek && (!current.lastDeliveredAt || deliveredAt > current.lastDeliveredAt))) {
        current.highestWeek = week
        current.lastDeliveredAt = deliveredAt
      }
      byEmail.set(email, current)
    }
  }
  return byEmail
}

async function setTemplateActive(isActive) {
  for (const id of templateIds) {
    await brevoJson(`https://api.brevo.com/v3/smtp/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify({ isActive })
    })
  }
}

async function ensureTables() {
  const migration = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../prisma/migrations/20260919170000_practical_ai_newsletter/migration.sql", import.meta.url), "utf8"))
  for (const statement of migration.split(/;\s*(?:\n|$)/).map((value) => value.trim()).filter(Boolean)) {
    await prisma.$executeRawUnsafe(statement)
  }
}

try {
  const [contacts, history] = await Promise.all([listContacts(), deliveredHistory()])
  const emails = Array.from(contacts.keys())
  const leads = emails.length ? await prisma.$queryRawUnsafe(
    `SELECT LOWER(email) AS email,
      SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(first_name, '') ORDER BY created_at DESC SEPARATOR '||'), '||', 1) AS firstName,
      MIN(created_at) AS startedAt
     FROM tochukwu_marketing_leads
     WHERE list_id = ? AND LOWER(email) IN (${emails.map(() => "?").join(",")})
     GROUP BY LOWER(email)`,
    listId,
    ...emails
  ) : []
  const plan = leads.map((lead) => {
    const email = normalizeEmail(lead.email)
    const delivered = history.get(email)
    const nextWeek = Math.min(52, Number(delivered?.highestWeek || 0) + 1)
    const nextSendAt = delivered?.lastDeliveredAt
      ? new Date(delivered.lastDeliveredAt.getTime() + 7 * 24 * 60 * 60 * 1000)
      : now
    return {
      email,
      recipientName: clean(lead.firstName || contacts.get(email), 180) || "there",
      startedAt: lead.startedAt || now,
      delivered,
      nextWeek,
      nextSendAt
    }
  })
  const countsByNextWeek = Object.fromEntries(Array.from(new Set(plan.map((item) => item.nextWeek))).sort((a, b) => a - b).map((week) => [week, plan.filter((item) => item.nextWeek === week).length]))
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    brevoActiveContacts: contacts.size,
    matchedDatabaseLeads: plan.length,
    contactsWithDeliveredHistory: plan.filter((item) => item.delivered?.highestWeek).length,
    nextWeekDistribution: countsByNextWeek,
    pauseBrevo,
    resumeBrevo
  }, null, 2))
  if (!apply) process.exitCode = 0
  else {
    await ensureTables()
    const existingRows = await prisma.$queryRawUnsafe(
      `SELECT c.recipient_key AS recipientKey, c.next_week AS nextWeek, COUNT(d.id) AS deliveryCount
       FROM tochukwu_practical_ai_newsletter_campaigns c
       LEFT JOIN tochukwu_practical_ai_newsletter_deliveries d ON d.campaign_id = c.id AND d.status = 'sent'
       GROUP BY c.id, c.recipient_key, c.next_week`
    )
    const existing = new Map(existingRows.map((row) => [String(row.recipientKey), {
      nextWeek: Number(row.nextWeek || 0),
      deliveryCount: Number(row.deliveryCount || 0)
    }]))
    const migrationPlan = plan.filter((item) => {
      const current = existing.get(emailKey(item.email))
      const requiredDeliveries = Number(item.delivered?.weeks?.size || 0)
      return !current || current.nextWeek < item.nextWeek || current.deliveryCount < requiredDeliveries
    })
    for (let offset = 0; offset < migrationPlan.length; offset += 10) {
      await Promise.all(migrationPlan.slice(offset, offset + 10).map(async (item) => {
        const key = emailKey(item.email)
        const campaignUuid = `pain_${crypto.randomUUID().replaceAll("-", "")}`
        await prisma.$executeRawUnsafe(
          `INSERT INTO tochukwu_practical_ai_newsletter_campaigns
            (campaign_uuid, recipient_email, recipient_key, recipient_name, started_at, next_week, next_send_at,
             status, attempts, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?)
           ON DUPLICATE KEY UPDATE recipient_email = VALUES(recipient_email), recipient_name = VALUES(recipient_name),
             next_send_at = IF(next_week < VALUES(next_week), VALUES(next_send_at), next_send_at),
             next_week = GREATEST(next_week, VALUES(next_week)),
             updated_at = VALUES(updated_at)`,
          campaignUuid, item.email, key, item.recipientName, item.startedAt, item.nextWeek, item.nextSendAt, now, now
        )
        const campaigns = await prisma.$queryRawUnsafe("SELECT id FROM tochukwu_practical_ai_newsletter_campaigns WHERE recipient_key = ? LIMIT 1", key)
        const campaignId = campaigns[0]?.id
        if (!campaignId || !item.delivered) return
        for (const [week, sentAt] of item.delivered.weeks.entries()) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO tochukwu_practical_ai_newsletter_deliveries
              (delivery_uuid, campaign_id, recipient_email, recipient_key, week_number, content_key,
               subject, status, attempts, sent_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', 1, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = 'sent', sent_at = COALESCE(sent_at, VALUES(sent_at)), updated_at = VALUES(updated_at)`,
            `paind_import_${crypto.randomUUID().replaceAll("-", "")}`, campaignId, item.email, key, week,
            `brevo-import-week-${String(week).padStart(2, "0")}`, `Imported Brevo newsletter week ${week}`, sentAt, now, now
          )
        }
      }))
    }
    if (pauseBrevo) await setTemplateActive(false)
    if (resumeBrevo) await setTemplateActive(true)
    console.log(JSON.stringify({ ok: true, audience: plan.length, migratedThisRun: migrationPlan.length, brevoTemplatesActive: pauseBrevo ? false : resumeBrevo ? true : "unchanged" }))
  }
} finally {
  await prisma.$disconnect()
}

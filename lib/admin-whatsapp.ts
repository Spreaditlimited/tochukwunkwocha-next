import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export type AdminWhatsAppContact = {
  pidContact: string
  label: string
  description: string
  phone: string
  messageId: string
  defaultMessage: string
  displayOrder: number
  isActive: boolean
}

type ContactInput = {
  pidContact?: unknown
  label?: unknown
  description?: unknown
  phone?: unknown
  messageId?: unknown
  defaultMessage?: unknown
  isActive?: unknown
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function boolValue(value: unknown) {
  return value !== false && value !== 0 && value !== "0" && value !== "false"
}

export async function ensureAdminWhatsAppContactsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_admin_whatsapp_contacts (
      id BIGINT NOT NULL AUTO_INCREMENT,
      pid_contact VARCHAR(191) NOT NULL,
      label VARCHAR(191) NOT NULL,
      description VARCHAR(255) NULL,
      phone VARCHAR(32) NULL,
      message_id VARCHAR(191) NULL,
      default_message LONGTEXT NULL,
      display_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by_admin_uuid VARCHAR(80) NULL,
      updated_by_admin_uuid VARCHAR(80) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_admin_whatsapp_pid (pid_contact),
      KEY idx_tochukwu_admin_whatsapp_order (display_order, created_at),
      KEY idx_tochukwu_admin_whatsapp_active (is_active, display_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

function mapContact(row: Record<string, unknown>): AdminWhatsAppContact {
  return {
    pidContact: clean(row.pidContact || row.pid_contact, 191),
    label: clean(row.label, 191),
    description: clean(row.description, 255),
    phone: clean(row.phone, 32),
    messageId: clean(row.messageId || row.message_id, 191),
    defaultMessage: clean(row.defaultMessage || row.default_message, 5000),
    displayOrder: Number(row.displayOrder || row.display_order || 0),
    isActive: boolValue(row.isActive ?? row.is_active)
  }
}

export async function listAdminWhatsAppContacts(includeInactive = true) {
  await ensureAdminWhatsAppContactsTable()

  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      pid_contact AS pidContact,
      label,
      description,
      phone,
      message_id AS messageId,
      default_message AS defaultMessage,
      display_order AS displayOrder,
      is_active AS isActive,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM tochukwu_admin_whatsapp_contacts
    ${includeInactive ? Prisma.empty : Prisma.sql`WHERE is_active = 1`}
    ORDER BY display_order ASC, created_at ASC
  `)

  return rows.map(mapContact)
}

export function normalizeAdminWhatsAppContact(input: ContactInput, index: number) {
  const label = clean(input.label, 191)
  const description = clean(input.description, 255)
  const phone = clean(input.phone, 32).replace(/\D/g, "")
  const messageId = clean(input.messageId, 191)
  const defaultMessage = clean(input.defaultMessage, 5000)
  const pidContact = clean(input.pidContact, 191) || `WAC-${randomUUID().replace(/-/g, "").slice(0, 18)}`

  if (!label) throw new Error(`Contact ${index + 1}: label is required.`)
  if (!phone && !messageId) throw new Error(`Contact ${index + 1}: add a WhatsApp phone number or message ID.`)
  if (phone && phone.length < 8) throw new Error(`Contact ${index + 1}: phone number is too short.`)

  return {
    pidContact,
    label,
    description: description || null,
    phone: phone || null,
    messageId: messageId || null,
    defaultMessage: defaultMessage || null,
    displayOrder: index,
    isActive: boolValue(input.isActive)
  }
}

export async function saveAdminWhatsAppContacts(input: {
  contacts: ContactInput[]
  adminUuid?: string
}) {
  await ensureAdminWhatsAppContactsTable()
  const contacts = input.contacts.map(normalizeAdminWhatsAppContact)
  if (!contacts.length) throw new Error("Add at least one WhatsApp contact.")

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM tochukwu_admin_whatsapp_contacts`

    for (const contact of contacts) {
      await tx.$executeRaw`
        INSERT INTO tochukwu_admin_whatsapp_contacts
          (pid_contact, label, description, phone, message_id, default_message, display_order, is_active, created_by_admin_uuid, updated_by_admin_uuid, created_at, updated_at)
        VALUES
          (${contact.pidContact}, ${contact.label}, ${contact.description}, ${contact.phone}, ${contact.messageId}, ${contact.defaultMessage},
           ${contact.displayOrder}, ${contact.isActive ? 1 : 0}, ${clean(input.adminUuid, 80) || null}, ${clean(input.adminUuid, 80) || null}, NOW(3), NOW(3))
      `
    }
  })

  return listAdminWhatsAppContacts(true)
}

import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  STUDENT_PROJECT_LINK_DECLARATION_TEXT,
  STUDENT_PROJECT_LINK_DECLARATION_VERSION
} from "@/lib/student-project-link-policy"

export type StudentProjectLink = {
  linkUuid: string
  title: string
  projectUrl: string
  host: string
  description: string
  courseSlug: string
  certificateNo: string
  isPublic: boolean
  status: string
  sourceType: "self_declared"
  declarationAcceptedAt: string | null
  createdAt: string | null
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function normalizeUrl(value: unknown) {
  const raw = clean(value, 1500)
  if (!raw) return null
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    if (!["http:", "https:"].includes(url.protocol)) return null
    return {
      projectUrl: url.toString(),
      host: url.hostname.replace(/^www\./i, "")
    }
  } catch {
    return null
  }
}

function mapRow(row: Record<string, unknown>): StudentProjectLink {
  return {
    linkUuid: clean(row.linkUuid || row.link_uuid, 80),
    title: clean(row.title, 220),
    projectUrl: clean(row.projectUrl || row.project_url, 1500),
    host: clean(row.host, 255),
    description: clean(row.description, 1000),
    courseSlug: clean(row.courseSlug || row.course_slug, 120),
    certificateNo: clean(row.certificateNo || row.certificate_no, 140),
    isPublic: Number(row.isPublic ?? row.is_public ?? 0) === 1,
    status: clean(row.status, 40),
    sourceType: "self_declared",
    declarationAcceptedAt: row.declarationAcceptedAt || row.declaration_accepted_at ? new Date(row.declarationAcceptedAt as string || row.declaration_accepted_at as string).toISOString() : null,
    createdAt: row.createdAt || row.created_at ? new Date(row.createdAt as string || row.created_at as string).toISOString() : null
  }
}

export async function ensureStudentProjectLinkTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS student_project_links (
      id BIGINT NOT NULL AUTO_INCREMENT,
      link_uuid VARCHAR(80) NOT NULL,
      account_id BIGINT NOT NULL,
      certificate_no VARCHAR(140) NULL,
      course_slug VARCHAR(120) NULL,
      title VARCHAR(220) NOT NULL,
      project_url TEXT NOT NULL,
      host VARCHAR(255) NOT NULL,
      description TEXT NULL,
      source_type VARCHAR(40) NOT NULL DEFAULT 'self_declared',
      declaration_version VARCHAR(40) NOT NULL,
      declaration_text TEXT NOT NULL,
      declaration_accepted_at DATETIME NOT NULL,
      is_public TINYINT(1) NOT NULL DEFAULT 1,
      status VARCHAR(40) NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_student_project_links_uuid (link_uuid),
      KEY idx_student_project_links_account (account_id, status, is_public),
      KEY idx_student_project_links_certificate (certificate_no),
      KEY idx_student_project_links_course (course_slug),
      KEY idx_student_project_links_created (created_at)
    )
  `)
}

export async function hasVerifiedStudentProjectProfile(accountId: bigint) {
  const rows = await prisma.$queryRaw<Array<{ total: bigint | number | null }>>(Prisma.sql`
    SELECT COUNT(*) AS total
    FROM tochukwu_learning_assignments
    WHERE account_id = ${accountId}
      AND status = 'approved'
      AND submission_kind = 'link'
      AND COALESCE(submission_link, '') <> ''
  `).catch(() => [{ total: 0 }])
  if (Number(rows[0]?.total || 0) > 0) return true

  const certRows = await prisma.$queryRaw<Array<{ total: bigint | number | null }>>(Prisma.sql`
    SELECT COUNT(*) AS total
    FROM student_certificates
    WHERE account_id = ${accountId}
      AND status = 'issued'
      AND COALESCE(project_url, '') <> ''
  `).catch(() => [{ total: 0 }])
  return Number(certRows[0]?.total || 0) > 0
}

export async function listStudentProjectLinks(accountId: bigint) {
  await ensureStudentProjectLinkTables()
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT link_uuid AS linkUuid, title, project_url AS projectUrl, host, description,
      course_slug AS courseSlug, certificate_no AS certificateNo, is_public AS isPublic,
      status, source_type AS sourceType, declaration_accepted_at AS declarationAcceptedAt,
      created_at AS createdAt
    FROM student_project_links
    WHERE account_id = ${accountId}
      AND status <> 'deleted'
    ORDER BY created_at DESC, id DESC
  `)
  return rows.map(mapRow)
}

export async function listPublicSelfDeclaredProjectLinks(accountIds: bigint[]) {
  await ensureStudentProjectLinkTables()
  const ids = Array.from(new Set(accountIds.map((id) => id.toString()).filter(Boolean))).map((id) => BigInt(id))
  if (!ids.length) return new Map<string, StudentProjectLink[]>()

  const rows = await prisma.$queryRaw<Array<Record<string, unknown> & { accountId: bigint }>>(Prisma.sql`
    SELECT account_id AS accountId, link_uuid AS linkUuid, title, project_url AS projectUrl, host, description,
      course_slug AS courseSlug, certificate_no AS certificateNo, is_public AS isPublic,
      status, source_type AS sourceType, declaration_accepted_at AS declarationAcceptedAt,
      created_at AS createdAt
    FROM student_project_links
    WHERE account_id IN (${Prisma.join(ids)})
      AND status = 'active'
      AND is_public = 1
    ORDER BY created_at DESC, id DESC
  `).catch(() => [])

  const grouped = new Map<string, StudentProjectLink[]>()
  for (const row of rows) {
    const key = row.accountId.toString()
    const links = grouped.get(key) || []
    links.push(mapRow(row))
    grouped.set(key, links)
  }
  return grouped
}

export async function createStudentProjectLink(input: {
  accountId: bigint
  title: string
  projectUrl: string
  description?: string
  courseSlug?: string
  certificateNo?: string
  declarationAccepted: boolean
}) {
  await ensureStudentProjectLinkTables()
  if (!(await hasVerifiedStudentProjectProfile(input.accountId))) {
    throw new Error("You can add additional public project links after your first project has been verified.")
  }
  if (!input.declarationAccepted) {
    throw new Error("You must accept the project ownership and indemnity declaration before adding this link.")
  }

  const title = clean(input.title, 220)
  const url = normalizeUrl(input.projectUrl)
  if (!title) throw new Error("Project title is required.")
  if (!url) throw new Error("Enter a valid public project URL.")

  const existing = await prisma.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`
    SELECT id
    FROM student_project_links
    WHERE account_id = ${input.accountId}
      AND LOWER(project_url) = ${url.projectUrl.toLowerCase()}
      AND status <> 'deleted'
    LIMIT 1
  `)
  if (existing.length) throw new Error("This project link is already in your profile.")

  const now = new Date()
  const linkUuid = `spl_${crypto.randomUUID().replace(/-/g, "")}`
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO student_project_links
      (link_uuid, account_id, certificate_no, course_slug, title, project_url, host, description,
       source_type, declaration_version, declaration_text, declaration_accepted_at, is_public, status, created_at, updated_at)
    VALUES
      (${linkUuid}, ${input.accountId}, ${clean(input.certificateNo, 140) || null}, ${clean(input.courseSlug, 120) || null},
       ${title}, ${url.projectUrl}, ${url.host}, ${clean(input.description, 1000) || null},
       'self_declared', ${STUDENT_PROJECT_LINK_DECLARATION_VERSION}, ${STUDENT_PROJECT_LINK_DECLARATION_TEXT},
       ${now}, 1, 'active', ${now}, ${now})
  `)

  return listStudentProjectLinks(input.accountId)
}

export async function updateStudentProjectLinkVisibility(accountId: bigint, linkUuid: string, isPublic: boolean) {
  await ensureStudentProjectLinkTables()
  const uuid = clean(linkUuid, 80)
  if (!uuid) throw new Error("Project link is required.")
  await prisma.$executeRaw(Prisma.sql`
    UPDATE student_project_links
    SET is_public = ${isPublic ? 1 : 0}, updated_at = ${new Date()}
    WHERE account_id = ${accountId}
      AND link_uuid = ${uuid}
      AND status <> 'deleted'
    LIMIT 1
  `)
  return listStudentProjectLinks(accountId)
}

export async function deleteStudentProjectLink(accountId: bigint, linkUuid: string) {
  await ensureStudentProjectLinkTables()
  const uuid = clean(linkUuid, 80)
  if (!uuid) throw new Error("Project link is required.")
  await prisma.$executeRaw(Prisma.sql`
    UPDATE student_project_links
    SET status = 'deleted', is_public = 0, updated_at = ${new Date()}
    WHERE account_id = ${accountId}
      AND link_uuid = ${uuid}
    LIMIT 1
  `)
  return listStudentProjectLinks(accountId)
}

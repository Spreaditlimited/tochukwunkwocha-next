import { Prisma } from "@prisma/client"
import { unstable_cache } from "next/cache"

import { prisma } from "@/lib/prisma"
import { listPublicSelfDeclaredProjectLinks, type StudentProjectLink } from "@/lib/student-project-links"

export type PublicStudentProjectLink = {
  label: string
  url: string
  host: string
  kind: "certificate_verification" | "self_declared"
  description: string
}

export type PublicStudentProject = {
  id: string
  projectUrl: string
  host: string
  courseSlug: string
  courseLabel: string
  learnerLabel: string
  sourceType: "individual" | "school"
  schoolName: string
  publishedAt: Date | null
  links: PublicStudentProjectLink[]
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function courseLabel(slug: string) {
  const normalized = clean(slug, 120).toLowerCase()
  if (normalized === "prompt-to-production") return "Prompt to Profit Advanced"
  if (normalized === "prompt-to-profit-schools") return "Prompt to Profit for Schools"
  if (normalized === "ai-for-everyday-business-owners") return "AI for Everyday Business Owners"
  if (normalized === "prompt-to-profit-holiday") return "Prompt to Profit"
  if (normalized === "prompt-to-profit") return "Prompt to Profit"
  return normalized
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function normalizePublicUrl(value: unknown) {
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

async function listPublicStudentProjectsUncached(limit = 60): Promise<PublicStudentProject[]> {
  const safeLimit = Math.max(6, Math.min(120, Number.isFinite(Number(limit)) ? Math.round(Number(limit)) : 60))
  const individual = await prisma.$queryRaw<Array<{
    id: bigint
    accountId: bigint
    projectUrl: string | null
    courseSlug: string | null
    studentName: string | null
    certificateNo: string | null
    publishedAt: Date | null
  }>>(Prisma.sql`
    SELECT a.id, a.account_id AS accountId, a.submission_link AS projectUrl, a.course_slug AS courseSlug,
      COALESCE(NULLIF(a.student_name, ''), NULLIF(c.recipient_name, '')) AS studentName,
      c.certificate_no AS certificateNo,
      COALESCE(a.reviewed_at, a.updated_at, a.created_at) AS publishedAt
    FROM tochukwu_learning_assignments a
    LEFT JOIN student_certificates c
      ON c.account_id = a.account_id
     AND c.course_slug = a.course_slug
     AND c.status = 'issued'
    WHERE a.status = 'approved'
      AND a.submission_kind = 'link'
      AND COALESCE(a.submission_link, '') <> ''
    ORDER BY COALESCE(a.reviewed_at, a.updated_at, a.created_at) DESC, a.id DESC
    LIMIT ${safeLimit}
  `).catch(() => [])
  const selfDeclaredLinksByAccount = await listPublicSelfDeclaredProjectLinks(individual.map((row) => row.accountId)).catch(() => new Map<string, StudentProjectLink[]>())

  const school = await prisma.$queryRaw<Array<{
    id: bigint
    projectUrl: string | null
    courseSlug: string | null
    schoolName: string | null
    publishedAt: Date | null
  }>>(Prisma.sql`
    SELECT s.id, s.website_url AS projectUrl, c.course_slug AS courseSlug,
      sc.school_name AS schoolName,
      COALESCE(c.issued_at, s.website_submitted_at, s.updated_at) AS publishedAt
    FROM school_students s
    JOIN school_certificates c
      ON c.student_id = s.id
     AND c.status = 'issued'
    JOIN school_accounts sc ON sc.id = s.school_id
    WHERE COALESCE(s.website_url, '') <> ''
      AND COALESCE(s.status, 'active') = 'active'
    ORDER BY COALESCE(c.issued_at, s.website_submitted_at, s.updated_at) DESC, s.id DESC
    LIMIT ${safeLimit}
  `).catch(() => [])

  const projects = [
    ...individual.map((row): PublicStudentProject | null => {
      const url = normalizePublicUrl(row.projectUrl)
      if (!url) return null
      const courseSlug = clean(row.courseSlug, 120)
      const certificateNo = clean(row.certificateNo, 140)
      const additionalLinks = selfDeclaredLinksByAccount.get(row.accountId.toString()) || []
      return {
        id: `individual-${row.id.toString()}`,
        ...url,
        courseSlug,
        courseLabel: courseLabel(courseSlug),
        learnerLabel: clean(row.studentName, 80) || "Student project",
        sourceType: "individual",
        schoolName: "",
        publishedAt: row.publishedAt,
        links: [
          ...(certificateNo
            ? [{
                label: "Verify certificate",
                url: `/certificates/verify/${encodeURIComponent(certificateNo)}`,
                host: "Certificate verification",
                kind: "certificate_verification" as const,
                description: "Academy-issued certificate verification page."
              }]
            : []),
          ...additionalLinks.map((link) => ({
            label: link.title,
            url: link.projectUrl,
            host: link.host,
            kind: "self_declared" as const,
            description: link.description
          }))
        ]
      }
    }),
    ...school.map((row): PublicStudentProject | null => {
      const url = normalizePublicUrl(row.projectUrl)
      if (!url) return null
      const courseSlug = clean(row.courseSlug, 120)
      const schoolName = clean(row.schoolName, 140)
      return {
        id: `school-${row.id.toString()}`,
        ...url,
        courseSlug,
        courseLabel: courseLabel(courseSlug),
        learnerLabel: schoolName ? `${schoolName} student project` : "School student project",
        sourceType: "school",
        schoolName,
        publishedAt: row.publishedAt,
        links: []
      }
    })
  ].filter((item): item is PublicStudentProject => Boolean(item))

  const seen = new Set<string>()
  return projects
    .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
    .filter((project) => {
      const key = project.projectUrl.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, safeLimit)
}

export const listPublicStudentProjects = unstable_cache(listPublicStudentProjectsUncached, ["public-student-projects"], {
  revalidate: 300,
  tags: ["public-student-projects"]
})

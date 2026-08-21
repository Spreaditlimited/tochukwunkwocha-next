import { Prisma } from "@prisma/client"
import { unstable_cache } from "next/cache"

import { prisma } from "@/lib/prisma"
import { listPublicSelfDeclaredProjectLinks, type StudentProjectLink } from "@/lib/student-project-links"
import {
  isAdultPortfolioAgeBand,
  parsePortfolioList,
  safeJsonObject,
  studentPortfolioSlug
} from "@/lib/student-portfolio-shared"

const CERTIFICATE_PROOF_MARKER = "[CERTIFICATE_PROOF_WEBSITE]"

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
  sourceType: "individual" | "group" | "school"
  schoolName: string
  publishedAt: Date | null
  links: PublicStudentProjectLink[]
  accountKey: string
  profileSlug: string
  profilePictureUrl: string
  professionalHeadline: string
  biography: string
  country: string
  skills: string[]
  featuredProjectSummary: string
  projectChallenge: string
  projectSolution: string
  projectLearning: string
  opportunityTypes: string[]
  openToWork: boolean
  enhancedProfilePublished: boolean
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
    accountUuid: string
    projectUrl: string | null
    courseSlug: string | null
    studentName: string | null
    certificateNo: string | null
    isGroupLearner: number | bigint | boolean
    publicProjectLearnerType: string | null
    profilePictureUrl: string | null
    ageBand: string | null
    publishedAt: Date | null
  }>>(Prisma.sql`
    SELECT a.id, a.account_id AS accountId, sa.account_uuid AS accountUuid,
      a.submission_link AS projectUrl, a.course_slug AS courseSlug,
      COALESCE(NULLIF(sa.full_name, ''), NULLIF(c.recipient_name, ''), NULLIF(a.student_name, '')) AS studentName,
      c.certificate_no AS certificateNo,
      EXISTS (
        SELECT 1
        FROM family_children child
        JOIN family_accounts family ON family.id = child.family_id
        WHERE child.account_id = a.account_id
          AND child.status = 'active'
          AND family.status = 'active'
      ) AS isGroupLearner,
      sa.public_project_learner_type AS publicProjectLearnerType,
      sa.profile_picture_url AS profilePictureUrl, sa.age_band AS ageBand,
      COALESCE(a.reviewed_at, a.updated_at, a.created_at) AS publishedAt
    FROM tochukwu_learning_assignments a
    JOIN student_accounts sa ON sa.id = a.account_id
    LEFT JOIN student_certificates c
      ON c.account_id = a.account_id
     AND c.course_slug = a.course_slug
     AND c.status = 'issued'
    WHERE a.status = 'approved'
      AND a.submission_kind = 'link'
      AND a.submission_text = ${CERTIFICATE_PROOF_MARKER}
      AND COALESCE(a.submission_link, '') <> ''
    ORDER BY COALESCE(a.reviewed_at, a.updated_at, a.created_at) DESC, a.id DESC
    LIMIT ${safeLimit}
  `).catch(() => [])
  const accountIds = individual.map((row) => row.accountId)
  const [selfDeclaredLinksByAccount, publicProfiles] = await Promise.all([
    listPublicSelfDeclaredProjectLinks(accountIds).catch(() => new Map<string, StudentProjectLink[]>()),
    accountIds.length ? prisma.$queryRaw<Array<{
      accountId: bigint
      publicSlug: string
      publicProfileConsent: number | bigint | boolean
      profilePictureConsent: number | bigint | boolean
      guardianConsentConfirmed: number | bigint | boolean
      openToWork: number | bigint | boolean
      isPublic: number | bigint | boolean
      publishedSnapshotJson: string | null
    }>>(Prisma.sql`
      SELECT account_id AS accountId, public_slug AS publicSlug,
        public_profile_consent AS publicProfileConsent,
        profile_picture_consent AS profilePictureConsent,
        guardian_consent_confirmed AS guardianConsentConfirmed,
        open_to_work AS openToWork, is_public AS isPublic,
        published_snapshot_json AS publishedSnapshotJson
      FROM student_public_profiles
      WHERE account_id IN (${Prisma.join(accountIds)})
    `).catch(() => []) : Promise.resolve([])
  ])
  const publicProfileMap = new Map(publicProfiles.map((profile) => [profile.accountId.toString(), profile]))

  const school = await prisma.$queryRaw<Array<{
    id: bigint
    projectUrl: string | null
    courseSlug: string | null
    schoolName: string | null
    certificateNo: string | null
    publishedAt: Date | null
  }>>(Prisma.sql`
    SELECT s.id, s.website_url AS projectUrl, c.course_slug AS courseSlug,
      sc.school_name AS schoolName, c.certificate_no AS certificateNo,
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
      const profile = publicProfileMap.get(row.accountId.toString())
      const snapshot = safeJsonObject(profile?.publishedSnapshotJson)
      const sourceType = Number(row.isGroupLearner || 0) === 1 || clean(row.publicProjectLearnerType, 24) === "young" ? "group" as const : "individual" as const
      const snapshotValue = (key: string, max: number) => clean(snapshot?.[key], max)
      const snapshotFlag = (key: string) => snapshot?.[key] === true || Number(snapshot?.[key] || 0) === 1
      const snapshotSkills = parsePortfolioList(snapshot?.skills, undefined, 12)
      const snapshotOpportunities = parsePortfolioList(snapshot?.opportunityTypes, undefined, 4)
      const profilePictureAuthorized = Boolean(clean(row.profilePictureUrl, 2000)) && Number(profile?.profilePictureConsent || 0) === 1 && snapshotFlag("profilePictureConsent")
      const requiredContentComplete = [
        snapshotValue("professionalHeadline", 220),
        snapshotValue("biography", 1800),
        snapshotValue("country", 120),
        snapshotValue("featuredProjectSummary", 1800),
        snapshotValue("projectChallenge", 1400),
        snapshotValue("projectSolution", 1800),
        snapshotValue("projectLearning", 1400)
      ].every(Boolean) && snapshotSkills.length >= 2
      const hiringChoiceComplete = !snapshotFlag("openToWork") || snapshotOpportunities.length > 0
      const enhancedProfilePublished = Boolean(snapshot) && Number(profile?.isPublic || 0) === 1 && Number(profile?.publicProfileConsent || 0) === 1 && profilePictureAuthorized && requiredContentComplete && hiringChoiceComplete && (sourceType === "individual" || Number(profile?.guardianConsentConfirmed || 0) === 1)
      const snapshotText = (key: string, max: number) => enhancedProfilePublished ? snapshotValue(key, max) : ""
      const snapshotBool = (key: string) => enhancedProfilePublished && snapshotFlag(key)
      const profilePictureVisible = enhancedProfilePublished && profilePictureAuthorized
      return {
        id: `individual-${row.id.toString()}`,
        ...url,
        courseSlug,
        courseLabel: courseLabel(courseSlug),
        learnerLabel: clean(row.studentName, 80) || "Student project",
        sourceType,
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
        ],
        accountKey: row.accountId.toString(),
        profileSlug: enhancedProfilePublished ? clean(profile?.publicSlug, 190) || studentPortfolioSlug(row.studentName, row.accountUuid) : "",
        profilePictureUrl: profilePictureVisible ? clean(row.profilePictureUrl, 2000) : "",
        professionalHeadline: snapshotText("professionalHeadline", 220),
        biography: snapshotText("biography", 1800),
        country: snapshotText("country", 120),
        skills: enhancedProfilePublished ? snapshotSkills : [],
        featuredProjectSummary: snapshotText("featuredProjectSummary", 1800),
        projectChallenge: snapshotText("projectChallenge", 1400),
        projectSolution: snapshotText("projectSolution", 1800),
        projectLearning: snapshotText("projectLearning", 1400),
        opportunityTypes: enhancedProfilePublished ? snapshotOpportunities : [],
        openToWork: sourceType === "individual" && isAdultPortfolioAgeBand(row.ageBand) && Number(profile?.openToWork || 0) === 1 && snapshotBool("openToWork"),
        enhancedProfilePublished
      }
    }),
    ...school.map((row): PublicStudentProject | null => {
      const url = normalizePublicUrl(row.projectUrl)
      if (!url) return null
      const courseSlug = clean(row.courseSlug, 120)
      const schoolName = clean(row.schoolName, 140)
      const certificateNo = clean(row.certificateNo, 140)
      return {
        id: `school-${row.id.toString()}`,
        ...url,
        courseSlug,
        courseLabel: courseLabel(courseSlug),
        learnerLabel: schoolName ? `${schoolName} student project` : "School student project",
        sourceType: "school",
        schoolName,
        publishedAt: row.publishedAt,
        links: certificateNo
          ? [{
              label: "Verify certificate",
              url: `/certificates/verify/${encodeURIComponent(certificateNo)}`,
              host: "Certificate verification",
              kind: "certificate_verification" as const,
              description: "Academy-issued certificate verification page."
            }]
          : [],
        accountKey: `school-${row.id.toString()}`,
        profileSlug: "",
        profilePictureUrl: "",
        professionalHeadline: "",
        biography: "",
        country: "",
        skills: [],
        featuredProjectSummary: "",
        projectChallenge: "",
        projectSolution: "",
        projectLearning: "",
        opportunityTypes: [],
        openToWork: false,
        enhancedProfilePublished: false
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

export async function getPublicStudentPortfolio(slugInput: string) {
  const slug = clean(slugInput, 190).toLowerCase()
  if (!slug) return null
  const projects = await listPublicStudentProjects(120)
  const primary = projects.find((project) => project.profileSlug.toLowerCase() === slug)
  if (!primary || primary.sourceType === "school") return null
  const studentProjects = projects.filter((project) => project.accountKey === primary.accountKey)
  const firstName = primary.learnerLabel.split(/\s+/).filter(Boolean)[0] || "this learner"
  const fallbackHeadline = `${primary.courseLabel} graduate and digital project builder`
  const fallbackBiography = `${primary.learnerLabel} is a graduate of ${primary.courseLabel} at Tochukwu Tech and AI Academy. Through practical, project-based learning, ${firstName} moved from learning core AI-assisted creation skills to publishing a working digital project that can be explored online. This portfolio documents verified work completed during that learning journey.`
  const fallbackSummary = `${primary.learnerLabel} planned, built and published a functional digital project while completing ${primary.courseLabel}. The finished work demonstrates the ability to turn an idea into a live result, review the outcome and share it publicly.`
  return {
    ...primary,
    projects: studentProjects,
    professionalHeadline: primary.professionalHeadline || fallbackHeadline,
    biography: primary.biography || fallbackBiography,
    featuredProjectSummary: primary.featuredProjectSummary || fallbackSummary,
    skills: primary.skills.length ? primary.skills : ["AI-assisted project development", "Digital problem solving"],
    enhancedProfilePublished: primary.enhancedProfilePublished
  }
}

import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  cleanPortfolioText,
  isAdultPortfolioAgeBand,
  isRecognizedPortfolioAgeBand,
  isYoungPortfolioAgeBand,
  parsePortfolioList,
  portfolioJsonList,
  STUDENT_OPPORTUNITY_TYPES,
  studentPortfolioSlug
} from "@/lib/student-portfolio-shared"
import { safeJsonObject } from "@/lib/student-portfolio-shared"

const OPPORTUNITY_VALUES = new Set(STUDENT_OPPORTUNITY_TYPES.map((item) => item.value))

export type StudentPublicPortfolioEditor = {
  profileUuid: string
  publicSlug: string
  displayName: string
  professionalHeadline: string
  biography: string
  country: string
  skills: string[]
  featuredProjectSummary: string
  projectChallenge: string
  projectSolution: string
  projectLearning: string
  opportunityTypes: string[]
  publicProfileConsent: boolean
  profilePictureConsent: boolean
  openToWork: boolean
  reviewStatus: string
  reviewNote: string
  hasPublishedVersion: boolean
  publishedAt: string | null
  hasVerifiedProject: boolean
  hasProfilePicture: boolean
  hiringEligible: boolean
  isManagedOrYoungLearner: boolean
  guardianConsentConfirmed: boolean
}

function bool(value: unknown) {
  return Number(value || 0) === 1 || value === true
}

async function accountPortfolioContext(accountId: bigint) {
  const rows = await prisma.$queryRaw<Array<{
    accountUuid: string
    fullName: string
    profilePictureUrl: string | null
    ageBand: string | null
    managedLearner: number | bigint | boolean
    hasVerifiedProject: number | bigint | boolean
    demographicCountry: string | null
    verifiedCourseSlug: string | null
    verifiedProjectUrl: string | null
  }>>(Prisma.sql`
    SELECT sa.account_uuid AS accountUuid, sa.full_name AS fullName,
      sa.profile_picture_url AS profilePictureUrl, sa.age_band AS ageBand,
      sa.demographic_country AS demographicCountry,
      (SELECT a.course_slug FROM tochukwu_learning_assignments a
        WHERE a.account_id = sa.id AND a.status = 'approved' AND a.submission_kind = 'link'
          AND COALESCE(a.submission_link, '') <> '' ORDER BY COALESCE(a.reviewed_at, a.updated_at, a.created_at) DESC LIMIT 1
      ) AS verifiedCourseSlug,
      (SELECT a.submission_link FROM tochukwu_learning_assignments a
        WHERE a.account_id = sa.id AND a.status = 'approved' AND a.submission_kind = 'link'
          AND COALESCE(a.submission_link, '') <> '' ORDER BY COALESCE(a.reviewed_at, a.updated_at, a.created_at) DESC LIMIT 1
      ) AS verifiedProjectUrl,
      (
        EXISTS (SELECT 1 FROM family_children fc WHERE fc.account_id = sa.id AND fc.status = 'active') OR
        EXISTS (SELECT 1 FROM school_students ss WHERE ss.account_id = sa.id AND ss.status = 'active')
      ) AS managedLearner,
      (
        EXISTS (
          SELECT 1 FROM tochukwu_learning_assignments a
          WHERE a.account_id = sa.id AND a.status = 'approved'
            AND a.submission_kind = 'link' AND COALESCE(a.submission_link, '') <> ''
        ) OR EXISTS (
          SELECT 1 FROM student_certificates c
          WHERE c.account_id = sa.id AND c.status = 'issued' AND COALESCE(c.project_url, '') <> ''
        )
      ) AS hasVerifiedProject
    FROM student_accounts sa
    WHERE sa.id = ${accountId}
    LIMIT 1
  `)
  if (!rows[0]) throw new Error("Student account not found.")
  const account = rows[0]
  const ageBand = cleanPortfolioText(account.ageBand, 40).toLowerCase()
  const managedOrYoung = bool(account.managedLearner) || isYoungPortfolioAgeBand(ageBand)
  return {
    ...account,
    managedOrYoung,
    hiringEligible: !managedOrYoung && isAdultPortfolioAgeBand(ageBand)
  }
}

function portfolioCourseLabel(slugInput: unknown) {
  const slug = cleanPortfolioText(slugInput, 120).toLowerCase()
  if (slug === "prompt-to-production") return "Prompt to Profit Advanced"
  if (slug === "prompt-to-profit-schools") return "Prompt to Profit for Schools"
  if (["prompt-to-profit", "prompt-to-profit-holiday"].includes(slug)) return "Prompt to Profit"
  if (slug === "ai-for-everyday-business-owners") return "AI for Everyday Business Owners"
  return slug.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") || "the Academy's project-based programme"
}

function verifiedProjectHost(value: unknown) {
  try {
    const raw = cleanPortfolioText(value, 1500)
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./i, "")
  } catch {
    return "a live digital project"
  }
}

export async function getStudentPublicPortfolioEditor(accountId: bigint): Promise<StudentPublicPortfolioEditor> {
  const [account, profile] = await Promise.all([
    accountPortfolioContext(accountId),
    prisma.studentPublicProfile.findUnique({ where: { accountId } })
  ])
  const courseLabel = portfolioCourseLabel(account.verifiedCourseSlug)
  const projectHost = verifiedProjectHost(account.verifiedProjectUrl)
  const draftHeadline = `${courseLabel} graduate and digital project builder`
  const draftBiography = `${account.fullName} completed ${courseLabel} at Tochukwu Tech and AI Academy, developing practical experience in using AI-assisted methods to plan, build and publish a working digital project. This portfolio presents verified work from that learning journey and a growing interest in creating useful, accessible digital solutions.`
  const draftSummary = `${account.fullName} planned, built and published a functional project at ${projectHost} while completing ${courseLabel}. The work demonstrates the process of moving from an initial idea to a live digital result that can be explored and evaluated by real users.`
  return {
    profileUuid: profile?.profileUuid || "",
    publicSlug: profile?.publicSlug || studentPortfolioSlug(account.fullName, account.accountUuid),
    displayName: profile?.displayName || account.fullName,
    professionalHeadline: profile?.professionalHeadline || draftHeadline,
    biography: profile?.biography || draftBiography,
    country: profile?.country || cleanPortfolioText(account.demographicCountry, 120),
    skills: profile ? parsePortfolioList(profile.skillsJson) : ["AI-assisted project development", "Digital problem solving"],
    featuredProjectSummary: profile?.featuredProjectSummary || draftSummary,
    projectChallenge: profile?.projectChallenge || "",
    projectSolution: profile?.projectSolution || "",
    projectLearning: profile?.projectLearning || "",
    opportunityTypes: parsePortfolioList(profile?.opportunityTypesJson, OPPORTUNITY_VALUES, 4),
    publicProfileConsent: Boolean(profile?.publicProfileConsent),
    profilePictureConsent: Boolean(profile?.profilePictureConsent),
    openToWork: account.hiringEligible && Boolean(profile?.openToWork),
    reviewStatus: profile?.reviewStatus || "not_submitted",
    reviewNote: profile?.reviewNote || "",
    hasPublishedVersion: Boolean(profile?.publishedSnapshotJson),
    publishedAt: profile?.publishedAt?.toISOString() || null,
    hasVerifiedProject: bool(account.hasVerifiedProject),
    hasProfilePicture: Boolean(cleanPortfolioText(account.profilePictureUrl, 2000)),
    hiringEligible: account.hiringEligible,
    isManagedOrYoungLearner: account.managedOrYoung,
    guardianConsentConfirmed: Boolean(profile?.guardianConsentConfirmed)
  }
}

export async function saveStudentPublicPortfolio(accountId: bigint, input: Record<string, unknown>) {
  const [account, existing] = await Promise.all([
    accountPortfolioContext(accountId),
    prisma.studentPublicProfile.findUnique({ where: { accountId } })
  ])
  if (!bool(account.hasVerifiedProject)) throw new Error("Your first project must be approved before you can publish a portfolio profile.")
  if (!isRecognizedPortfolioAgeBand(account.ageBand)) {
    throw new Error("Complete the Age Band field in your main profile before submitting a public portfolio.")
  }

  const professionalHeadline = cleanPortfolioText(input.professionalHeadline, 220)
  const biography = cleanPortfolioText(input.biography, 1800)
  const country = cleanPortfolioText(input.country, 120)
  const featuredProjectSummary = cleanPortfolioText(input.featuredProjectSummary, 1800)
  const projectChallenge = cleanPortfolioText(input.projectChallenge, 1400)
  const projectSolution = cleanPortfolioText(input.projectSolution, 1800)
  const projectLearning = cleanPortfolioText(input.projectLearning, 1400)
  const skills = parsePortfolioList(input.skills, undefined, 12)
  const publicProfileConsent = input.publicProfileConsent === true
  const profilePictureConsent = publicProfileConsent && Boolean(cleanPortfolioText(account.profilePictureUrl, 2000)) && input.profilePictureConsent === true
  const opportunityTypes = parsePortfolioList(input.opportunityTypes, OPPORTUNITY_VALUES, 4)
  const openToWork = publicProfileConsent && account.hiringEligible && input.openToWork === true

  if (publicProfileConsent) {
    if (professionalHeadline.length < 20) throw new Error("Add a professional headline of at least 20 characters.")
    if (biography.length < 80) throw new Error("Add a professional introduction of at least 80 characters.")
    if (!country) throw new Error("Add the country you authorise us to show publicly.")
    if (featuredProjectSummary.length < 60) throw new Error("Add a featured project summary of at least 60 characters.")
    if (projectChallenge.length < 40) throw new Error("Explain the project problem or challenge in at least 40 characters.")
    if (projectSolution.length < 40) throw new Error("Explain your solution and contribution in at least 40 characters.")
    if (projectLearning.length < 40) throw new Error("Explain what you learned in at least 40 characters.")
    if (skills.length < 2) throw new Error("Add at least two demonstrated skills.")
    if (!cleanPortfolioText(account.profilePictureUrl, 2000) || !profilePictureConsent) {
      throw new Error("Upload a profile picture and authorise us to publish it before submitting your public portfolio.")
    }
  }
  if (openToWork && !opportunityTypes.length) throw new Error("Choose at least one type of opportunity.")

  const now = new Date()
  const data = {
    publicSlug: existing?.publicSlug || studentPortfolioSlug(account.fullName, account.accountUuid),
    displayName: account.fullName,
    professionalHeadline: professionalHeadline || null,
    biography: biography || null,
    country: country || null,
    skillsJson: portfolioJsonList(skills),
    featuredProjectSummary: featuredProjectSummary || null,
    projectChallenge: projectChallenge || null,
    projectSolution: projectSolution || null,
    projectLearning: projectLearning || null,
    opportunityTypesJson: portfolioJsonList(opportunityTypes, OPPORTUNITY_VALUES, 4),
    publicProfileConsent,
    profilePictureConsent,
    openToWork,
    isPublic: publicProfileConsent,
    reviewStatus: "pending",
    reviewNote: null,
    reviewedBy: null,
    reviewedAt: null,
    updatedAt: now
  }

  if (existing) {
    await prisma.studentPublicProfile.update({ where: { id: existing.id }, data })
  } else {
    await prisma.studentPublicProfile.create({
      data: {
        profileUuid: `spp_${crypto.randomUUID().replace(/-/g, "")}`,
        accountId,
        createdAt: now,
        ...data
      }
    })
  }
  return getStudentPublicPortfolioEditor(accountId)
}

export async function listAdminStudentPortfolios() {
  const profiles = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT p.id, p.profile_uuid AS profileUuid, p.account_id AS accountId,
      p.public_slug AS publicSlug, p.display_name AS displayName,
      p.professional_headline AS professionalHeadline, p.biography, p.country,
      p.skills_json AS skillsJson, p.featured_project_summary AS featuredProjectSummary,
      p.project_challenge AS projectChallenge, p.project_solution AS projectSolution,
      p.project_learning AS projectLearning, p.opportunity_types_json AS opportunityTypesJson,
      p.public_profile_consent AS publicProfileConsent,
      p.profile_picture_consent AS profilePictureConsent, p.open_to_work AS openToWork,
      p.guardian_consent_confirmed AS guardianConsentConfirmed,
      p.is_public AS isPublic, p.review_status AS reviewStatus, p.review_note AS reviewNote,
      p.published_snapshot_json AS publishedSnapshotJson, p.published_at AS publishedAt,
      p.updated_at AS updatedAt, sa.email, sa.profile_picture_url AS profilePictureUrl,
      sa.age_band AS ageBand,
      CASE WHEN LOWER(TRIM(COALESCE(sa.age_band, ''))) IN ('under-13', '13-17')
        OR EXISTS (SELECT 1 FROM family_children fc WHERE fc.account_id = sa.id AND fc.status = 'active')
        OR EXISTS (SELECT 1 FROM school_students ss WHERE ss.account_id = sa.id AND ss.status = 'active')
        THEN 1 ELSE 0 END AS managedOrYoung
    FROM student_public_profiles p
    JOIN student_accounts sa ON sa.id = p.account_id
    ORDER BY CASE p.review_status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,
      p.updated_at DESC
    LIMIT 250
  `)
  return profiles.map((row) => ({
    ...row,
    id: String(row.id || ""),
    accountId: String(row.accountId || ""),
    skills: parsePortfolioList(row.skillsJson),
    opportunityTypes: parsePortfolioList(row.opportunityTypesJson, OPPORTUNITY_VALUES, 4),
    publicProfileConsent: bool(row.publicProfileConsent),
    profilePictureConsent: bool(row.profilePictureConsent),
    guardianConsentConfirmed: bool(row.guardianConsentConfirmed),
    openToWork: bool(row.openToWork),
    isPublic: bool(row.isPublic),
    managedOrYoung: bool(row.managedOrYoung),
    hasPublishedVersion: Boolean(cleanPortfolioText(row.publishedSnapshotJson, 10))
  }))
}

export async function listAdminStudentHireEnquiries() {
  return prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT e.enquiry_uuid AS enquiryUuid, e.enquirer_name AS enquirerName,
      e.organisation, e.enquirer_email AS enquirerEmail,
      e.opportunity_type AS opportunityType, e.timeline, e.budget_range AS budgetRange,
      e.message, e.status, e.delivery_status AS deliveryStatus,
      e.delivery_error AS deliveryError, e.admin_note AS adminNote,
      e.created_at AS createdAt, p.display_name AS studentName, p.public_slug AS publicSlug
    FROM student_hire_enquiries e
    JOIN student_public_profiles p ON p.id = e.profile_id
    ORDER BY CASE e.status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, e.created_at DESC
    LIMIT 250
  `)
}

export async function reviewStudentPublicPortfolio(input: {
  profileUuid: string
  reviewStatus: string
  reviewNote: string
  reviewedBy: string
  guardianConsentConfirmed?: boolean
}) {
  const profileUuid = cleanPortfolioText(input.profileUuid, 64)
  const reviewStatus = cleanPortfolioText(input.reviewStatus, 24).toLowerCase()
  const reviewNote = cleanPortfolioText(input.reviewNote, 2000)
  if (!profileUuid) throw new Error("Portfolio profile is required.")
  if (!["approved", "rejected", "pending"].includes(reviewStatus)) throw new Error("Select a valid review status.")
  const profile = await prisma.studentPublicProfile.findUnique({ where: { profileUuid } })
  if (!profile) throw new Error("Portfolio profile not found.")
  if (reviewStatus === "approved" && !profile.publicProfileConsent) throw new Error("The student has not consented to public publication.")
  const account = await accountPortfolioContext(profile.accountId)
  const guardianConsentConfirmed = account.managedOrYoung && reviewStatus === "approved"
    ? input.guardianConsentConfirmed === true
    : profile.guardianConsentConfirmed
  if (reviewStatus === "approved" && account.managedOrYoung && !guardianConsentConfirmed) {
    throw new Error("Confirm responsible-adult consent before publishing this young or managed learner's enhanced portfolio.")
  }
  if (reviewStatus === "approved") {
    const requiredTexts = [
      profile.professionalHeadline,
      profile.biography,
      profile.country,
      profile.featuredProjectSummary,
      profile.projectChallenge,
      profile.projectSolution,
      profile.projectLearning
    ].map((item) => cleanPortfolioText(item, 2000))
    if (requiredTexts.some((item) => !item) || parsePortfolioList(profile.skillsJson).length < 2) {
      throw new Error("The student must complete every required portfolio field before approval.")
    }
    if (!cleanPortfolioText(account.profilePictureUrl, 2000) || !profile.profilePictureConsent) {
      throw new Error("The student must upload and authorise a profile picture before approval.")
    }
    if (profile.openToWork && !parsePortfolioList(profile.opportunityTypesJson, OPPORTUNITY_VALUES, 4).length) {
      throw new Error("The student must select at least one opportunity type before hiring can be published.")
    }
  }

  const now = new Date()
  const snapshot = reviewStatus === "approved" ? JSON.stringify({
    displayName: profile.displayName,
    professionalHeadline: profile.professionalHeadline || "",
    biography: profile.biography || "",
    country: profile.country || "",
    skills: parsePortfolioList(profile.skillsJson),
    featuredProjectSummary: profile.featuredProjectSummary || "",
    projectChallenge: profile.projectChallenge || "",
    projectSolution: profile.projectSolution || "",
    projectLearning: profile.projectLearning || "",
    opportunityTypes: parsePortfolioList(profile.opportunityTypesJson, OPPORTUNITY_VALUES, 4),
    profilePictureConsent: profile.profilePictureConsent,
    openToWork: profile.openToWork
  }) : profile.publishedSnapshotJson

  await prisma.studentPublicProfile.update({
    where: { id: profile.id },
    data: {
      reviewStatus,
      reviewNote: reviewNote || null,
      reviewedBy: cleanPortfolioText(input.reviewedBy, 180) || null,
      reviewedAt: now,
      guardianConsentConfirmed,
      publishedSnapshotJson: snapshot,
      publishedAt: reviewStatus === "approved" ? now : profile.publishedAt,
      updatedAt: now
    }
  })
  return { publicSlug: profile.publicSlug, reviewStatus }
}

export async function updateStudentHireEnquiry(input: { enquiryUuid: string; status: string; adminNote: string }) {
  const enquiryUuid = cleanPortfolioText(input.enquiryUuid, 64)
  const status = cleanPortfolioText(input.status, 32).toLowerCase()
  if (!enquiryUuid) throw new Error("Hiring enquiry is required.")
  if (!["new", "in_progress", "closed", "spam"].includes(status)) throw new Error("Select a valid enquiry status.")
  const result = await prisma.studentHireEnquiry.updateMany({
    where: { enquiryUuid },
    data: { status, adminNote: cleanPortfolioText(input.adminNote, 2000) || null, updatedAt: new Date() }
  })
  if (!result.count) throw new Error("Hiring enquiry not found.")
  return { status }
}

export async function getHireableStudentProfile(publicSlugInput: string) {
  const publicSlug = cleanPortfolioText(publicSlugInput, 190).toLowerCase()
  if (!publicSlug) return null
  const rows = await prisma.$queryRaw<Array<{
    profileId: bigint
    accountId: bigint
    publicSlug: string
    displayName: string
    studentEmail: string
    ageBand: string | null
    openToWork: number | bigint | boolean
    isPublic: number | bigint | boolean
    publicProfileConsent: number | bigint | boolean
    publishedSnapshotJson: string | null
    managedOrYoung: number | bigint | boolean
  }>>(Prisma.sql`
    SELECT p.id AS profileId, p.account_id AS accountId, p.public_slug AS publicSlug,
      p.display_name AS displayName, sa.email AS studentEmail, sa.age_band AS ageBand,
      p.open_to_work AS openToWork, p.is_public AS isPublic,
      p.public_profile_consent AS publicProfileConsent,
      p.published_snapshot_json AS publishedSnapshotJson,
      CASE WHEN LOWER(TRIM(COALESCE(sa.age_band, ''))) IN ('under-13', '13-17')
        OR EXISTS (SELECT 1 FROM family_children fc WHERE fc.account_id = sa.id AND fc.status = 'active')
        OR EXISTS (SELECT 1 FROM school_students ss WHERE ss.account_id = sa.id AND ss.status = 'active')
        THEN 1 ELSE 0 END AS managedOrYoung
    FROM student_public_profiles p
    JOIN student_accounts sa ON sa.id = p.account_id
    WHERE LOWER(p.public_slug) = ${publicSlug}
    LIMIT 1
  `)
  const row = rows[0]
  if (!row || bool(row.managedOrYoung) || !isAdultPortfolioAgeBand(row.ageBand) || !bool(row.openToWork) || !bool(row.isPublic) || !bool(row.publicProfileConsent)) return null
  const snapshot = safeJsonObject(row.publishedSnapshotJson)
  if (!snapshot || snapshot.openToWork !== true) return null
  return {
    profileId: row.profileId,
    accountId: row.accountId,
    publicSlug: row.publicSlug,
    displayName: cleanPortfolioText(snapshot.displayName || row.displayName, 180),
    studentEmail: cleanPortfolioText(row.studentEmail, 190).toLowerCase(),
    opportunityTypes: parsePortfolioList(snapshot.opportunityTypes, OPPORTUNITY_VALUES, 4)
  }
}

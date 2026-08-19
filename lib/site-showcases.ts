import crypto from "crypto"

import { prisma } from "@/lib/prisma"

export const siteShowcasePlacements = [
  { key: "prompt-to-profit", label: "Prompt to Profit" },
  { key: "prompt-to-profit-schools", label: "Prompt to Profit for Schools" }
] as const

export type SiteShowcasePlacement = typeof siteShowcasePlacements[number]["key"]

export type SiteShowcase = {
  id: number
  showcaseUuid: string
  placementKey: SiteShowcasePlacement
  title: string
  url: string
  displayUrl: string
  sortOrder: number
  isActive: boolean
  createdAt: Date | null
  updatedAt: Date | null
}

const defaultShowcases: Array<Omit<SiteShowcase, "id" | "createdAt" | "updatedAt">> = [
  {
    showcaseUuid: "ptp-showcase-01",
    placementKey: "prompt-to-profit",
    title: "M-Philz Wears",
    url: "https://splendorous-marzipan-6befc0.netlify.app/",
    displayUrl: "splendorous-marzipan-6befc0.netlify.app",
    sortOrder: 10,
    isActive: true
  },
  {
    showcaseUuid: "ptp-showcase-02",
    placementKey: "prompt-to-profit",
    title: "Student website 2",
    url: "https://olytribe.com.ng/",
    displayUrl: "olytribe.com.ng",
    sortOrder: 20,
    isActive: true
  },
  {
    showcaseUuid: "ptp-showcase-03",
    placementKey: "prompt-to-profit",
    title: "The ManCave Naija",
    url: "https://themancavenaija.com/",
    displayUrl: "themancavenaija.com",
    sortOrder: 30,
    isActive: true
  },
  {
    showcaseUuid: "ptp-showcase-04",
    placementKey: "prompt-to-profit",
    title: "Hybrid Academy Inventory & Fee Manager",
    url: "https://legendary-mochi-24add5.netlify.app/",
    displayUrl: "legendary-mochi-24add5.netlify.app",
    sortOrder: 40,
    isActive: true
  },
  {
    showcaseUuid: "ptp-schools-showcase-01",
    placementKey: "prompt-to-profit-schools",
    title: "The Man Cave Naija",
    url: "https://themancavenaija.com/",
    displayUrl: "themancavenaija.com",
    sortOrder: 10,
    isActive: true
  },
  {
    showcaseUuid: "ptp-schools-showcase-02",
    placementKey: "prompt-to-profit-schools",
    title: "Kachi Game Arcade",
    url: "https://kachigamearcade.netlify.app/",
    displayUrl: "kachigamearcade.netlify.app",
    sortOrder: 20,
    isActive: true
  }
]

function clean(value: unknown, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

function normalizePlacement(value: unknown): SiteShowcasePlacement {
  const placement = clean(value, 80)
  if (siteShowcasePlacements.some((item) => item.key === placement)) {
    return placement as SiteShowcasePlacement
  }
  throw new Error("Choose where this website should appear.")
}

function normalizeWebsiteUrl(value: unknown) {
  const input = clean(value, 2000)
  if (!input) throw new Error("Website URL is required.")
  try {
    const url = new URL(input)
    if (url.protocol !== "https:") throw new Error("Only secure HTTPS website URLs can be embedded.")
    url.hash = ""
    return url.toString()
  } catch (error) {
    if (error instanceof Error && error.message.includes("HTTPS")) throw error
    throw new Error("Enter a complete website URL beginning with https://.")
  }
}

function defaultDisplayUrl(urlValue: string) {
  const url = new URL(urlValue)
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "")
  return `${url.hostname}${path}`
}

function rowToSiteShowcase(row: Record<string, unknown>): SiteShowcase {
  return {
    id: Number(row.id || 0),
    showcaseUuid: clean(row.showcaseUuid || row.showcase_uuid, 80),
    placementKey: normalizePlacement(row.placementKey || row.placement_key),
    title: clean(row.title, 180),
    url: clean(row.siteUrl || row.site_url, 2000),
    displayUrl: clean(row.displayUrl || row.display_url, 500),
    sortOrder: Number(row.sortOrder || row.sort_order || 0),
    isActive: Number(row.isActive ?? row.is_active ?? 0) === 1,
    createdAt: row.createdAt || row.created_at ? new Date(row.createdAt as string || row.created_at as string) : null,
    updatedAt: row.updatedAt || row.updated_at ? new Date(row.updatedAt as string || row.updated_at as string) : null
  }
}

function missingTable(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  return /doesn't exist|does not exist|unknown table|1146/i.test(message)
}

export async function ensureSiteShowcaseTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_site_showcases (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      showcase_uuid VARCHAR(80) NOT NULL,
      placement_key VARCHAR(80) NOT NULL,
      title VARCHAR(180) NOT NULL,
      site_url TEXT NOT NULL,
      display_url VARCHAR(500) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_tochukwu_site_showcase_uuid (showcase_uuid),
      KEY idx_tochukwu_site_showcase_placement (placement_key, is_active, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const countRows = await prisma.$queryRaw<Array<{ total: bigint | number }>>`
    SELECT COUNT(*) AS total FROM tochukwu_site_showcases
  `
  if (Number(countRows[0]?.total || 0) > 0) return

  const now = new Date()
  for (const site of defaultShowcases) {
    await prisma.$executeRaw`
      INSERT IGNORE INTO tochukwu_site_showcases
        (showcase_uuid, placement_key, title, site_url, display_url, sort_order, is_active, created_at, updated_at)
      VALUES
        (${site.showcaseUuid}, ${site.placementKey}, ${site.title}, ${site.url}, ${site.displayUrl},
         ${site.sortOrder}, ${site.isActive ? 1 : 0}, ${now}, ${now})
    `
  }
}

async function selectSiteShowcases(placement?: SiteShowcasePlacement, activeOnly = false) {
  const placementKey = placement || ""
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, showcase_uuid AS showcaseUuid, placement_key AS placementKey, title,
      site_url AS siteUrl, display_url AS displayUrl, sort_order AS sortOrder,
      is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
    FROM tochukwu_site_showcases
    WHERE (${placementKey} = '' OR placement_key = ${placementKey})
      AND (${activeOnly ? 1 : 0} = 0 OR is_active = 1)
    ORDER BY placement_key ASC, sort_order ASC, id ASC
  `
  return rows.map(rowToSiteShowcase)
}

export async function listAdminSiteShowcases() {
  return selectSiteShowcases()
}

export async function listPublishedSiteShowcases(placement: SiteShowcasePlacement) {
  try {
    return await selectSiteShowcases(placement, true)
  } catch (error) {
    if (!missingTable(error)) throw error
    await ensureSiteShowcaseTable()
    return selectSiteShowcases(placement, true)
  }
}

export async function upsertSiteShowcaseFromForm(formData: FormData) {
  await ensureSiteShowcaseTable()
  const showcaseUuid = clean(formData.get("showcaseUuid"), 80) || crypto.randomUUID()
  const placementKey = normalizePlacement(formData.get("placementKey"))
  const title = clean(formData.get("title"), 180)
  if (!title) throw new Error("Website title is required.")
  const url = normalizeWebsiteUrl(formData.get("siteUrl"))
  const displayUrl = clean(formData.get("displayUrl"), 500) || defaultDisplayUrl(url)
  const requestedSortOrder = Number(formData.get("sortOrder"))
  const sortOrder = Number.isFinite(requestedSortOrder)
    ? Math.min(9999, Math.max(0, Math.round(requestedSortOrder)))
    : 0
  const isActive = formData.get("isActive") === "on"
  const now = new Date()

  await prisma.$executeRaw`
    INSERT INTO tochukwu_site_showcases
      (showcase_uuid, placement_key, title, site_url, display_url, sort_order, is_active, created_at, updated_at)
    VALUES
      (${showcaseUuid}, ${placementKey}, ${title}, ${url}, ${displayUrl}, ${sortOrder}, ${isActive ? 1 : 0}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      placement_key = VALUES(placement_key),
      title = VALUES(title),
      site_url = VALUES(site_url),
      display_url = VALUES(display_url),
      sort_order = VALUES(sort_order),
      is_active = VALUES(is_active),
      updated_at = VALUES(updated_at)
  `

  return { showcaseUuid, placementKey, title, isActive }
}

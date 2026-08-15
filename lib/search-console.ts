import crypto from "crypto"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
const DEFAULT_SITE_URL = "sc-domain:tochukwunkwocha.com"
const DEFAULT_ROW_LIMIT = 25_000

type ImportOptions = { startDate?: string; endDate?: string; days?: number; siteUrl?: string; rowLimit?: number }
type GscRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }
type StatRecord = { date: string; pageUrl: string; query: string; country: string | null; device: string | null; clicks: number; impressions: number; ctr: number; position: number }
export type SearchConsoleImportReservation = { runUuid: string; siteUrl: string; startDate: string; endDate: string; rowLimit: number }
export type SearchConsoleImportStartResult =
  | { started: true; run: SearchConsoleImportReservation }
  | { started: false; run: SearchConsoleImportReservation & { startedAt: Date | null } }

function clean(value: unknown, max = 1000) { return String(value || "").trim().slice(0, max) }
function dateOnly(value: Date) { return value.toISOString().slice(0, 10) }
function sqlDate(value: string) { return new Date(`${value}T00:00:00.000Z`) }
function base64Url(input: string | Buffer) { return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_") }

function parseCredentials(value: string) {
  const raw = clean(value, 20_000)
  if (!raw) return null
  try { return JSON.parse(raw) } catch {
    try { return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) } catch { return null }
  }
}

function getCredentials() {
  const json = parseCredentials(process.env.GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON || "") || parseCredentials(process.env.GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON_BASE64 || "")
  const clientEmail = clean(json?.client_email || process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL, 255)
  const privateKey = clean(json?.private_key || process.env.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY, 5000).replace(/\\n/g, "\n")
  if (!clientEmail || !privateKey) throw new Error("Google Search Console service account credentials are not configured.")
  return { clientEmail, privateKey }
}

async function accessToken() {
  const credentials = getCredentials()
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({ iss: credentials.clientEmail, scope: SEARCH_CONSOLE_SCOPE, aud: TOKEN_URL, exp: now + 3600, iat: now }))}`
  const signer = crypto.createSign("RSA-SHA256")
  signer.update(unsigned); signer.end()
  const assertion = `${unsigned}.${base64Url(signer.sign(credentials.privateKey))}`
  const response = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) })
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.access_token) throw new Error(body?.error_description || body?.error || "Could not get Google access token.")
  return clean(body.access_token, 2000)
}

async function queryGsc(input: SearchConsoleImportReservation & { accessToken: string; startRow: number }) {
  const response = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(input.siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate: input.startDate, endDate: input.endDate, dimensions: ["date", "page", "query", "country", "device"], rowLimit: input.rowLimit, startRow: input.startRow })
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error?.message || body?.error || `Search Console query failed with status ${response.status}.`)
  return (body?.rows || []) as GscRow[]
}

function resolveWindow(options: ImportOptions) {
  if (options.startDate && options.endDate) return { startDate: options.startDate, endDate: options.endDate }
  const days = Math.min(30, Math.max(1, Number(options.days || 3)))
  const end = new Date(); end.setUTCDate(end.getUTCDate() - 2)
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - days + 1)
  return { startDate: dateOnly(start), endDate: dateOnly(end) }
}

function blogSlugFromUrl(pageUrl: string) {
  try { return decodeURIComponent(new URL(pageUrl).pathname.match(/^\/blog\/([^/?#]+)/)?.[1] || "").trim().toLowerCase() || null }
  catch { return decodeURIComponent(pageUrl.match(/\/blog\/([^/?#]+)/)?.[1] || "").trim().toLowerCase() || null }
}

function inferCta(query: string, pageUrl: string) {
  const text = `${query} ${pageUrl}`.toLowerCase()
  if (/\b(school|teacher|student|classroom|parent|principal)\b/.test(text)) return "ai_for_schools"
  if (/\b(business plan|startup|market research|financial projection|pitch)\b/.test(text)) return "business_plan"
  if (/\b(build|automation|workflow|app|website|product)\b/.test(text)) return "private_ai_build_coaching"
  return "prompt_to_profit"
}

function keywordTokens(value: string) {
  const stopWords = new Set(["a", "an", "and", "are", "for", "from", "how", "in", "is", "of", "on", "or", "the", "to", "what", "with"])
  return clean(value, 700).toLowerCase().replace(/artificial intelligence/g, "ai").replace(/[^a-z0-9]+/g, " ").split(/\s+/)
    .map((token) => token === "courses" ? "course" : token)
    .filter((token) => token && !stopWords.has(token))
}

function hasMeaningfulBlogCoverage(query: string, blogs: Array<{ blogTitle: string; blogSlug: string }>) {
  const queryTokens = Array.from(new Set(keywordTokens(query)))
  if (queryTokens.length < 2) return true
  return blogs.some((blog) => {
    const blogTokens = new Set(keywordTokens(`${blog.blogTitle} ${blog.blogSlug}`))
    const covered = queryTokens.filter((token) => blogTokens.has(token)).length
    return covered / queryTokens.length >= 0.8
  })
}

async function saveRecords(records: StatRecord[], run: SearchConsoleImportReservation) {
  for (let index = 0; index < records.length; index += 100) {
    const now = new Date()
    const values = records.slice(index, index + 100).map((record) => {
      const slug = blogSlugFromUrl(record.pageUrl)
      const key = crypto.createHash("sha256").update([record.date, run.siteUrl, record.pageUrl, record.query, record.country || "", record.device || ""].join("\0")).digest("hex")
      return Prisma.sql`(${`sc_stat_${crypto.randomUUID()}`}, ${key}, ${run.runUuid}, ${sqlDate(record.date)}, ${run.siteUrl}, ${record.pageUrl}, ${slug}, ${record.query}, ${record.country}, ${record.device}, ${record.clicks}, ${record.impressions}, ${record.ctr}, ${record.position}, ${sqlDate(run.startDate)}, ${sqlDate(run.endDate)}, ${now})`
    })
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO tochukwu_search_console_query_stats
        (stat_uuid, dedupe_key, run_uuid, date, site_url, page_url, blog_slug, query, country, device, clicks, impressions, ctr, position, start_date, end_date, created_at)
      VALUES ${Prisma.join(values)}
      ON DUPLICATE KEY UPDATE clicks=VALUES(clicks), impressions=VALUES(impressions), ctr=VALUES(ctr), position=VALUES(position), run_uuid=VALUES(run_uuid), start_date=VALUES(start_date), end_date=VALUES(end_date)
    `)
  }
}

export async function generateSearchConsoleOpportunities(input: { startDate: string; endDate: string; minImpressions?: number }) {
  const min = Math.max(10, Number(input.minImpressions || 50))
  const newContentMin = Math.max(10, Number(process.env.SEO_MIN_GSC_NEW_CONTENT_IMPRESSIONS || 20))
  const [rows, keywordRows, blogs] = await Promise.all([
    prisma.$queryRaw<Array<{ pageUrl: string; query: string; clicks: bigint | number; impressions: bigint | number; ctr: unknown; position: unknown }>>(Prisma.sql`
    SELECT page_url AS pageUrl, query, SUM(clicks) AS clicks, SUM(impressions) AS impressions,
      CASE WHEN SUM(impressions)>0 THEN SUM(clicks)/SUM(impressions) ELSE 0 END AS ctr,
      AVG(position) AS position
    FROM tochukwu_search_console_query_stats
    WHERE date >= ${sqlDate(input.startDate)} AND date <= ${sqlDate(input.endDate)} AND page_url LIKE '%/blog/%'
    GROUP BY page_url, query HAVING impressions > 0 ORDER BY impressions DESC LIMIT 2000
    `),
    prisma.$queryRaw<Array<{ pageUrl: string; blogSlug: string | null; query: string; clicks: bigint | number; impressions: bigint | number; position: unknown }>>(Prisma.sql`
      SELECT page_url AS pageUrl, blog_slug AS blogSlug, query, SUM(clicks) AS clicks,
        SUM(impressions) AS impressions, AVG(position) AS position
      FROM tochukwu_search_console_query_stats
      WHERE date >= ${sqlDate(input.startDate)} AND date <= ${sqlDate(input.endDate)}
      GROUP BY page_url, blog_slug, query HAVING impressions > 0
      ORDER BY impressions DESC LIMIT 5000
    `),
    prisma.tochukwuBlogPost.findMany({ select: { blogTitle: true, blogSlug: true } })
  ])
  type QueryAggregate = { query: string; clicks: number; impressions: number; weightedPosition: number }
  type PageAggregate = { blogSlug: string; pageUrl: string; pageUrlImpressions: number; queries: Map<string, QueryAggregate> }
  const candidatesByPage = new Map<string, PageAggregate>()
  for (const row of rows) {
    const blogSlug = blogSlugFromUrl(row.pageUrl)
    const query = clean(row.query, 700)
    const impressions = Number(row.impressions || 0)
    if (!blogSlug || !query || impressions <= 0) continue
    const page = candidatesByPage.get(blogSlug) || { blogSlug, pageUrl: row.pageUrl, pageUrlImpressions: 0, queries: new Map<string, QueryAggregate>() }
    const existingQuery = page.queries.get(query) || { query, clicks: 0, impressions: 0, weightedPosition: 0 }
    existingQuery.clicks += Number(row.clicks || 0)
    existingQuery.impressions += impressions
    existingQuery.weightedPosition += Number(row.position || 0) * impressions
    page.queries.set(query, existingQuery)
    if (impressions > page.pageUrlImpressions) {
      page.pageUrl = row.pageUrl
      page.pageUrlImpressions = impressions
    }
    candidatesByPage.set(blogSlug, page)
  }

  const pageCandidates = Array.from(candidatesByPage.values()).flatMap((page) => {
    const ranked = Array.from(page.queries.values()).sort((left, right) => right.impressions - left.impressions)
    const impressions = ranked.reduce((total, query) => total + query.impressions, 0)
    if (!ranked.length || impressions < min) return []
    const clicks = ranked.reduce((total, query) => total + query.clicks, 0)
    const position = ranked.reduce((total, query) => total + query.weightedPosition, 0) / impressions
    const ctr = clicks / impressions
    const primaryQuery = ranked[0].query
    const opportunityType = ctr < 0.015 && position <= 12 ? "low_ctr" : position >= 5 ? "ranking_push" : ""
    if (!opportunityType) return []
    const confidence = Math.min(opportunityType === "low_ctr" ? 0.95 : 0.93, (opportunityType === "low_ctr" ? 0.82 : 0.78) + impressions / (opportunityType === "low_ctr" ? 10_000 : 12_000))
    const recommendation = opportunityType === "low_ctr"
      ? `Improve the title and meta description for "${primaryQuery}". The article's query cluster has strong impressions but weak CTR.`
      : position <= 20
        ? `Expand the article around "${primaryQuery}" and its related queries, then add an FAQ and internal links. The article is close to page-one gains.`
        : `Strengthen and consolidate the article around "${primaryQuery}" and its related queries. It is earning meaningful impressions but needs deeper coverage and internal links to move up from its current ranking range.`
    return [{ pageUrl: page.pageUrl, blogSlug: page.blogSlug, opportunityType, primaryQuery, queryCluster: ranked.map((query) => query.query), clicks, impressions, ctr, position, confidence, recommendation, recommendedCta: inferCta(primaryQuery, page.pageUrl) }]
  }).sort((left, right) => right.impressions - left.impressions)

  let saved = 0
  for (const candidate of pageCandidates.slice(0, 50)) {
    const blog = await prisma.tochukwuBlogPost.findUnique({ where: { blogSlug: candidate.blogSlug }, select: { pidBlog: true } })
    const active = await prisma.tochukwuSeoOpportunity.findMany({
      where: { blogSlug: candidate.blogSlug, status: { in: ["open", "reviewing"] } },
      orderBy: [{ impressions: "desc" }, { updatedAt: "desc" }]
    })
    const existing = active.find((opportunity) => opportunity.status === "reviewing") || active[0]
    const now = new Date()
    const data = { ...candidate, pidBlog: blog?.pidBlog || null, queryCluster: JSON.stringify(candidate.queryCluster), sourceStartDate: sqlDate(input.startDate), sourceEndDate: sqlDate(input.endDate), updatedAt: now }
    if (existing) {
      await prisma.$transaction([
        ...(existing.status === "open" ? [prisma.tochukwuSeoOpportunity.update({ where: { pidOpportunity: existing.pidOpportunity }, data })] : []),
        prisma.tochukwuSeoOpportunity.updateMany({ where: { pidOpportunity: { not: existing.pidOpportunity }, blogSlug: candidate.blogSlug, status: { in: ["open", "reviewing"] } }, data: { status: "dismissed", updatedAt: now } })
      ])
    } else {
      await prisma.tochukwuSeoOpportunity.create({ data: { ...data, pidOpportunity: `seo_opp_${crypto.randomUUID()}`, status: "open", createdAt: now } })
    }
    saved += 1
  }

  type KeywordAggregate = { query: string; pageUrl: string; pageImpressions: number; clicks: number; impressions: number; blogImpressions: number; weightedPosition: number }
  const keywords = new Map<string, KeywordAggregate>()
  for (const row of keywordRows) {
    const query = clean(row.query, 700)
    const key = query.toLowerCase()
    const impressions = Number(row.impressions || 0)
    if (!query || impressions <= 0) continue
    const keyword = keywords.get(key) || { query, pageUrl: row.pageUrl, pageImpressions: 0, clicks: 0, impressions: 0, blogImpressions: 0, weightedPosition: 0 }
    keyword.clicks += Number(row.clicks || 0)
    keyword.impressions += impressions
    keyword.blogImpressions += row.blogSlug ? impressions : 0
    keyword.weightedPosition += Number(row.position || 0) * impressions
    if (impressions > keyword.pageImpressions) {
      keyword.pageUrl = row.pageUrl
      keyword.pageImpressions = impressions
    }
    keywords.set(key, keyword)
  }

  const newContentCandidates = Array.from(keywords.values()).flatMap((keyword) => {
    const tokens = Array.from(new Set(keywordTokens(keyword.query)))
    const blogCoverage = keyword.blogImpressions / keyword.impressions
    if (keyword.impressions < newContentMin || tokens.length < 2 || blogCoverage >= 0.25) return []
    if (/\b(?:tochukwu|tochukwunkwocha)\b/i.test(keyword.query) || /\bsite:/i.test(keyword.query) || keyword.query.length > 160 || /^ai\d+$/i.test(keyword.query)) return []
    if (hasMeaningfulBlogCoverage(keyword.query, blogs)) return []
    const position = keyword.weightedPosition / keyword.impressions
    const ctr = keyword.clicks / keyword.impressions
    const confidence = Math.min(0.94, 0.72 + keyword.impressions / 1000 + (position <= 20 ? 0.08 : 0))
    return [{
      pageUrl: keyword.pageUrl, blogSlug: null, pidBlog: null, opportunityType: "new_content", primaryQuery: keyword.query,
      queryCluster: [keyword.query], clicks: keyword.clicks, impressions: keyword.impressions, ctr, position, confidence,
      recommendation: `Create a dedicated article targeting "${keyword.query}". Search Console recorded ${keyword.impressions} impressions, but no existing blog post meaningfully covers this search intent.`,
      recommendedCta: inferCta(keyword.query, keyword.pageUrl)
    }]
  }).sort((left, right) => right.impressions - left.impressions).slice(0, 50)

  let newContentSaved = 0
  for (const candidate of newContentCandidates) {
    const active = await prisma.tochukwuSeoOpportunity.findMany({
      where: { opportunityType: "new_content", primaryQuery: candidate.primaryQuery, status: { in: ["open", "reviewing"] } },
      orderBy: [{ updatedAt: "desc" }]
    })
    const existing = active.find((opportunity) => opportunity.status === "reviewing") || active[0]
    const now = new Date()
    const data = { ...candidate, queryCluster: JSON.stringify(candidate.queryCluster), sourceStartDate: sqlDate(input.startDate), sourceEndDate: sqlDate(input.endDate), updatedAt: now }
    if (existing) {
      await prisma.$transaction([
        ...(existing.status === "open" ? [prisma.tochukwuSeoOpportunity.update({ where: { pidOpportunity: existing.pidOpportunity }, data })] : []),
        prisma.tochukwuSeoOpportunity.updateMany({ where: { pidOpportunity: { not: existing.pidOpportunity }, opportunityType: "new_content", primaryQuery: candidate.primaryQuery, status: { in: ["open", "reviewing"] } }, data: { status: "dismissed", updatedAt: now } })
      ])
    } else {
      await prisma.tochukwuSeoOpportunity.create({ data: { ...data, pidOpportunity: `seo_opp_${crypto.randomUUID()}`, status: "open", createdAt: now } })
    }
    newContentSaved += 1
  }

  return {
    actionableQueries: pageCandidates.reduce((total, candidate) => total + candidate.queryCluster.length, 0),
    candidates: pageCandidates.length, saved,
    newContentCandidates: newContentCandidates.length, newContentSaved
  }
}

export async function startSearchConsolePerformanceImport(options: ImportOptions = {}): Promise<SearchConsoleImportStartResult> {
  const siteUrl = clean(options.siteUrl || process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL || DEFAULT_SITE_URL, 255)
  const { startDate, endDate } = resolveWindow(options)
  const rowLimit = Math.min(DEFAULT_ROW_LIMIT, Math.max(1000, Number(options.rowLimit || DEFAULT_ROW_LIMIT)))
  const staleBefore = new Date(Date.now() - 60 * 60 * 1000)
  return prisma.$transaction(async (tx) => {
    await tx.tochukwuSearchConsoleImportRun.updateMany({ where: { status: "started", startedAt: { lt: staleBefore } }, data: { status: "failed", errorMessage: "The import stopped before it could complete.", completedAt: new Date(), updatedAt: new Date() } })
    const activeRows = await tx.$queryRaw<Array<{ runUuid: string; siteUrl: string; sourceStartDate: Date; sourceEndDate: Date; startedAt: Date | null }>>(Prisma.sql`
      SELECT run_uuid AS runUuid, site_url AS siteUrl, source_start_date AS sourceStartDate,
        source_end_date AS sourceEndDate, started_at AS startedAt
      FROM tochukwu_search_console_import_runs WHERE status = 'started'
      ORDER BY started_at DESC LIMIT 1 FOR UPDATE
    `)
    const active = activeRows[0]
    if (active) return { started: false as const, run: { runUuid: active.runUuid, siteUrl: active.siteUrl, startDate: dateOnly(active.sourceStartDate!), endDate: dateOnly(active.sourceEndDate!), rowLimit, startedAt: active.startedAt } }
    const runUuid = `sc_run_${crypto.randomUUID()}`
    await tx.tochukwuSearchConsoleImportRun.create({ data: { runUuid, source: "google_search_console", siteUrl, dimensions: "date,page,query,country,device", status: "started", startedAt: new Date(), sourceStartDate: sqlDate(startDate), sourceEndDate: sqlDate(endDate), rowCount: 0, createdAt: new Date(), updatedAt: new Date() } })
    return { started: true as const, run: { runUuid, siteUrl, startDate, endDate, rowLimit } }
  })
}

export async function executeSearchConsolePerformanceImport(run: SearchConsoleImportReservation) {
  try {
    const token = await accessToken(); let startRow = 0; let totalRows = 0
    while (true) {
      const rows = await queryGsc({ ...run, accessToken: token, startRow })
      if (!rows.length) break
      const records = rows.flatMap((row): StatRecord[] => {
        const [date, pageUrl, query, country, device] = row.keys || []
        return date && pageUrl && query ? [{ date, pageUrl, query, country: clean(country, 20) || null, device: clean(device, 40) || null, clicks: Math.round(Number(row.clicks || 0)), impressions: Math.round(Number(row.impressions || 0)), ctr: Number(row.ctr || 0), position: Number(row.position || 0) }] : []
      })
      await saveRecords(records, run); totalRows += records.length
      await prisma.tochukwuSearchConsoleImportRun.update({ where: { runUuid: run.runUuid }, data: { rowCount: totalRows, updatedAt: new Date() } })
      if (rows.length < run.rowLimit || (startRow += run.rowLimit) >= 100_000) break
    }
    const opportunities = await generateSearchConsoleOpportunities({ startDate: run.startDate, endDate: run.endDate, minImpressions: Number(process.env.SEO_MIN_GSC_IMPRESSIONS || 50) })
    await prisma.tochukwuSearchConsoleImportRun.update({ where: { runUuid: run.runUuid }, data: { status: "completed", completedAt: new Date(), rowCount: totalRows, updatedAt: new Date() } })
    return { ok: true, ...run, rows: totalRows, opportunities }
  } catch (error) {
    await prisma.tochukwuSearchConsoleImportRun.update({ where: { runUuid: run.runUuid }, data: { status: "failed", errorMessage: error instanceof Error ? error.message : "Search Console import failed.", completedAt: new Date(), updatedAt: new Date() } }).catch(() => undefined)
    throw error
  }
}

export async function importSearchConsolePerformance(options: ImportOptions = {}) {
  const reservation = await startSearchConsolePerformanceImport(options)
  if (!reservation.started) throw new Error(`Search Console import ${reservation.run.runUuid} is already running.`)
  return executeSearchConsolePerformanceImport(reservation.run)
}

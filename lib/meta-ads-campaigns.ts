import { randomUUID } from "node:crypto"

import { prisma } from "@/lib/prisma"
import { assertMetaAdsDailyBudget } from "@/lib/meta-ads-budget"
import { getMetaAdsApiConfiguration, metaAdsRequest, safeMetaAdsError } from "@/lib/meta-ads-api"
import { addColumnIfMissing } from "@/lib/schema-guards"

export const PROMPT_TO_PROFIT_URL = "https://www.tochukwunkwocha.com/courses/prompt-to-profit"
export const PROMPT_TO_PROFIT_OBJECTIVE = "OUTCOME_SALES"

type Actor = { adminUuid: string; email: string }

export type MetaAsset = { id: string; name: string }
export type MetaImageAsset = { hash: string; name: string; url: string; width: number | null; height: number | null }
export type MetaVideoAsset = { id: string; name: string; thumbnailUrl: string; sourceUrl: string }
export type MetaAdsAssets = {
  account: { id: string; name: string; currency: string; status: number }
  pages: MetaAsset[]
  instagramAccounts: MetaAsset[]
  pixels: MetaAsset[]
  images: MetaImageAsset[]
  videos: MetaVideoAsset[]
}

export type MetaAdDraft = {
  draftUuid: string
  status: string
  campaignName: string
  dailyBudgetMinor: number
  countryCode: string
  ageMin: number
  ageMax: number
  primaryText: string
  primaryTexts: string[]
  headline: string
  description: string
  imageUrl: string
  mediaType: "image" | "video"
  imageHash: string | null
  videoId: string | null
  callToAction: string
  pageId: string
  instagramActorId: string | null
  pixelId: string
  campaignId: string | null
  adsetId: string | null
  creativeId: string | null
  adId: string | null
  lastError: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
  assetCount: number
}

type DraftMediaInput = { type: "image" | "video"; id: string }

type DraftInput = {
  campaignName: string
  dailyBudgetMinor: number
  countryCode: string
  ageMin: number
  ageMax: number
  primaryTexts: string[]
  headline: string
  description: string
  media: DraftMediaInput[]
  callToAction: string
  pageId: string
  instagramActorId?: string
  pixelId: string
}

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max)
}

function safeId(value: unknown, label: string) {
  const id = clean(value, 80)
  if (!/^\d+$/.test(id)) throw new Error(`${label} is invalid.`)
  return id
}

function safePreviewUrl(value: unknown) {
  const raw = clean(value, 1500)
  if (!raw) return ""
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error("The selected media preview URL is invalid.")
  }
  if (parsed.protocol !== "https:") throw new Error("The selected media preview must use HTTPS.")
  return parsed.toString()
}

function validateDraftInput(input: DraftInput) {
  const campaignName = clean(input.campaignName, 180)
  const rawPrimaryTexts = Array.isArray(input.primaryTexts) ? input.primaryTexts : []
  const primaryTexts = rawPrimaryTexts.map((value) => clean(value, 1250)).filter(Boolean)
  const headline = clean(input.headline, 255)
  const description = clean(input.description, 255)
  const countryCode = clean(input.countryCode, 2).toUpperCase()
  const callToAction = clean(input.callToAction, 40).toUpperCase()
  const ageMin = Math.trunc(Number(input.ageMin))
  const ageMax = Math.trunc(Number(input.ageMax))
  const dailyBudgetMinor = Math.trunc(Number(input.dailyBudgetMinor))
  if (campaignName.length < 4) throw new Error("Enter a descriptive campaign name.")
  if (!primaryTexts.length || primaryTexts.length > 5) throw new Error("Provide between 1 and 5 primary-text options.")
  if (primaryTexts.some((text) => text.length < 20)) throw new Error("Each primary-text option must contain at least 20 characters.")
  if (new Set(primaryTexts.map((text) => text.toLowerCase())).size !== primaryTexts.length) throw new Error("Primary-text options must be different.")
  if (headline.length < 4) throw new Error("The ad headline is too short.")
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error("The audience country code is invalid.")
  if (!Number.isInteger(ageMin) || !Number.isInteger(ageMax) || ageMin < 18 || ageMax > 65 || ageMin > ageMax) {
    throw new Error("The audience ages must be between 18 and 65.")
  }
  if (!["LEARN_MORE", "SIGN_UP"].includes(callToAction)) throw new Error("The call to action is invalid.")
  const rawMedia = Array.isArray(input.media) ? input.media : []
  if (rawMedia.length > 10) throw new Error("Select no more than 10 assets for one flexible advert.")
  const media = rawMedia.map((item) => {
    const type = clean(item?.type, 10).toLowerCase()
    if (type === "image") {
      const id = clean(item?.id, 190)
      if (!/^[A-Za-z0-9_-]{8,190}$/.test(id)) throw new Error("A selected Meta image hash is invalid.")
      return { type: "image" as const, id }
    }
    if (type === "video") return { type: "video" as const, id: safeId(item?.id, "Meta video") }
    throw new Error("A selected Meta creative type is invalid.")
  })
  if (!media.length) throw new Error("Select at least one image or video from the Meta media library.")
  if (new Set(media.map((item) => `${item.type}:${item.id}`)).size !== media.length) throw new Error("The same creative cannot be selected twice.")
  return {
    campaignName,
    primaryTexts,
    headline,
    description,
    countryCode,
    callToAction,
    ageMin,
    ageMax,
    dailyBudgetMinor,
    media,
    pageId: safeId(input.pageId, "Facebook Page"),
    instagramActorId: input.instagramActorId ? safeId(input.instagramActorId, "Instagram account") : "",
    pixelId: safeId(input.pixelId, "Purchase pixel")
  }
}

export async function ensureMetaAdsCampaignTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_meta_ad_drafts (
      id BIGINT NOT NULL AUTO_INCREMENT,
      draft_uuid VARCHAR(80) NOT NULL,
      status VARCHAR(40) NOT NULL,
      campaign_name VARCHAR(180) NOT NULL,
      daily_budget_minor BIGINT NOT NULL,
      country_code VARCHAR(2) NOT NULL,
      age_min INT NOT NULL,
      age_max INT NOT NULL,
      primary_text TEXT NOT NULL,
      primary_texts_json LONGTEXT NULL,
      headline VARCHAR(255) NOT NULL,
      description VARCHAR(255) NULL,
      image_url TEXT NOT NULL,
      media_type VARCHAR(10) NOT NULL DEFAULT 'image',
      image_hash VARCHAR(190) NULL,
      video_id VARCHAR(80) NULL,
      call_to_action VARCHAR(40) NOT NULL,
      page_id VARCHAR(80) NOT NULL,
      instagram_actor_id VARCHAR(80) NULL,
      pixel_id VARCHAR(80) NOT NULL,
      campaign_id VARCHAR(80) NULL,
      adset_id VARCHAR(80) NULL,
      creative_id VARCHAR(80) NULL,
      ad_id VARCHAR(80) NULL,
      last_error TEXT NULL,
      created_by VARCHAR(190) NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      published_at DATETIME NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_meta_ad_draft_uuid (draft_uuid),
      KEY idx_meta_ad_draft_status_created (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await addColumnIfMissing("tochukwu_meta_ad_drafts", "media_type", "VARCHAR(10) NOT NULL DEFAULT 'image' AFTER image_url")
  await addColumnIfMissing("tochukwu_meta_ad_drafts", "primary_texts_json", "LONGTEXT NULL AFTER primary_text")
  await addColumnIfMissing("tochukwu_meta_ad_drafts", "image_hash", "VARCHAR(190) NULL AFTER media_type")
  await addColumnIfMissing("tochukwu_meta_ad_drafts", "video_id", "VARCHAR(80) NULL AFTER image_hash")
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_meta_ad_draft_assets (
      id BIGINT NOT NULL AUTO_INCREMENT,
      item_uuid VARCHAR(80) NOT NULL,
      draft_uuid VARCHAR(80) NOT NULL,
      item_position INT NOT NULL,
      media_type VARCHAR(10) NOT NULL,
      image_hash VARCHAR(190) NULL,
      video_id VARCHAR(80) NULL,
      preview_url TEXT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_meta_ad_draft_item_uuid (item_uuid),
      UNIQUE KEY uniq_meta_ad_draft_position (draft_uuid, item_position),
      KEY idx_meta_ad_draft_assets_draft (draft_uuid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tochukwu_meta_ad_audit (
      id BIGINT NOT NULL AUTO_INCREMENT,
      audit_uuid VARCHAR(80) NOT NULL,
      draft_uuid VARCHAR(80) NOT NULL,
      event_type VARCHAR(80) NOT NULL,
      actor VARCHAR(190) NOT NULL,
      details_json TEXT NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_meta_ad_audit_uuid (audit_uuid),
      KEY idx_meta_ad_audit_draft_created (draft_uuid, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function audit(draftUuid: string, eventType: string, actor: Actor, details: Record<string, unknown> = {}) {
  await prisma.$executeRaw`
    INSERT INTO tochukwu_meta_ad_audit (audit_uuid, draft_uuid, event_type, actor, details_json, created_at)
    VALUES (${randomUUID()}, ${draftUuid}, ${eventType}, ${actor.email || actor.adminUuid}, ${JSON.stringify(details)}, ${new Date()})
  `
}

export async function discoverMetaAdsAssets(): Promise<MetaAdsAssets> {
  const { accountId } = await getMetaAdsApiConfiguration()
  type PageItem = { id: string; name?: string }
  type PageConnection = { data?: PageItem[] }
  const [account, promotePagesEdge, promotableObjects, existingCreatives, instagramAccounts, pixels, images, videos] = await Promise.all([
    metaAdsRequest<{
      id: string
      name?: string
      currency?: string
      account_status?: number
      promote_pages?: PageConnection | PageItem[]
    }>(`act_${accountId}`, { params: { fields: "id,name,currency,account_status,promote_pages{id,name}" } }),
    metaAdsRequest<PageConnection>(`act_${accountId}/promote_pages`, { params: { fields: "id,name", limit: 100 } }).catch(() => ({ data: [] })),
    metaAdsRequest<{ ad_account_promotable_objects?: { promotable_page_ids?: string[] } }>(`act_${accountId}`, { params: { fields: "ad_account_promotable_objects" } }).catch((): { ad_account_promotable_objects?: { promotable_page_ids?: string[] } } => ({})),
    metaAdsRequest<{ data?: Array<{ object_story_spec?: { page_id?: string }; effective_object_story_id?: string }> }>(`act_${accountId}/adcreatives`, { params: { fields: "object_story_spec,effective_object_story_id", limit: 100 } }).catch(() => ({ data: [] })),
    metaAdsRequest<{ data?: Array<{ id: string; username?: string; name?: string }> }>(`act_${accountId}/instagram_accounts`, { params: { fields: "id,username,name", limit: 100 } }),
    metaAdsRequest<{ data?: Array<{ id: string; name?: string }> }>(`act_${accountId}/adspixels`, { params: { fields: "id,name", limit: 100 } }),
    metaAdsRequest<{ data?: Array<{ hash?: string; name?: string; url?: string; width?: number; height?: number }> }>(`act_${accountId}/adimages`, { params: { fields: "hash,name,url,width,height", limit: 100 } }),
    metaAdsRequest<{ data?: Array<{ id: string; title?: string; description?: string; source?: string; thumbnails?: { data?: Array<{ uri?: string; is_preferred?: boolean }> } }> }>(`act_${accountId}/advideos`, { params: { fields: "id,title,description,source,thumbnails{uri,is_preferred}", limit: 100 } })
  ])
  if (String(account.currency || "").toUpperCase() !== "NGN") throw new Error("Publishing is locked because the Meta ad account is not denominated in NGN.")
  if (Number(account.account_status || 0) !== 1) throw new Error("Publishing is locked because the Meta ad account is not active.")
  const normalize = (items: Array<{ id: string; name?: string; username?: string }> = []) => items.map((item) => ({ id: String(item.id), name: String(item.username || item.name || item.id) }))
  const embeddedPages = Array.isArray(account.promote_pages) ? account.promote_pages : account.promote_pages?.data || []
  const promotablePageIds = promotableObjects.ad_account_promotable_objects?.promotable_page_ids || []
  const pageMap = new Map<string, MetaAsset>()
  for (const page of [...embeddedPages, ...(promotePagesEdge.data || [])]) {
    if (page.id) pageMap.set(String(page.id), { id: String(page.id), name: String(page.name || `Facebook Page ${page.id}`) })
  }
  for (const pageId of promotablePageIds) {
    if (pageId && !pageMap.has(String(pageId))) pageMap.set(String(pageId), { id: String(pageId), name: `Facebook Page ${pageId}` })
  }
  for (const creative of existingCreatives.data || []) {
    const pageId = String(creative.object_story_spec?.page_id || creative.effective_object_story_id?.split("_", 1)[0] || "")
    if (/^\d+$/.test(pageId) && !pageMap.has(pageId)) pageMap.set(pageId, { id: pageId, name: `Facebook Page ${pageId}` })
  }
  const unnamedPages = [...pageMap.values()].filter((page) => page.name === `Facebook Page ${page.id}`)
  const resolvedPageNames = await Promise.all(unnamedPages.map((page) =>
    metaAdsRequest<PageItem>(page.id, { params: { fields: "id,name" } }).catch(() => page)
  ))
  for (const page of resolvedPageNames) pageMap.set(String(page.id), { id: String(page.id), name: String(page.name || `Facebook Page ${page.id}`) })
  if (!pageMap.size) {
    console.warn("[meta-ads-assets] No promotable Facebook Page was returned", { accountId, embeddedPages: embeddedPages.length, edgePages: promotePagesEdge.data?.length || 0, promotablePageIds: promotablePageIds.length, creativeFallbacks: existingCreatives.data?.length || 0 })
  }
  return {
    account: { id: account.id, name: account.name || account.id, currency: account.currency || "", status: Number(account.account_status || 0) },
    pages: [...pageMap.values()],
    instagramAccounts: normalize(instagramAccounts.data),
    pixels: normalize(pixels.data),
    images: (images.data || []).flatMap((item) => item.hash ? [{ hash: String(item.hash), name: String(item.name || `Image ${String(item.hash).slice(0, 8)}`), url: String(item.url || ""), width: Number.isFinite(item.width) ? Number(item.width) : null, height: Number.isFinite(item.height) ? Number(item.height) : null }] : []),
    videos: (videos.data || []).map((item) => {
      const thumbnails = item.thumbnails?.data || []
      const thumbnail = thumbnails.find((entry) => entry.is_preferred) || thumbnails[0]
      return { id: String(item.id), name: String(item.title || item.description || `Video ${item.id}`), thumbnailUrl: String(thumbnail?.uri || ""), sourceUrl: String(item.source || "") }
    })
  }
}

export async function listMetaAdDrafts(limit = 30): Promise<MetaAdDraft[]> {
  await ensureMetaAdsCampaignTables()
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100))
  const rows = await prisma.$queryRawUnsafe<MetaAdDraft[]>(`
    SELECT draft_uuid AS draftUuid, status, campaign_name AS campaignName,
      CAST(daily_budget_minor AS SIGNED) AS dailyBudgetMinor, country_code AS countryCode,
      age_min AS ageMin, age_max AS ageMax, primary_text AS primaryText, headline,
      primary_texts_json AS primaryTextsJson,
      description, image_url AS imageUrl, media_type AS mediaType, image_hash AS imageHash,
      video_id AS videoId, call_to_action AS callToAction, page_id AS pageId,
      instagram_actor_id AS instagramActorId, pixel_id AS pixelId, campaign_id AS campaignId,
      adset_id AS adsetId, creative_id AS creativeId, ad_id AS adId, last_error AS lastError,
      created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt,
      (SELECT COUNT(*) FROM tochukwu_meta_ad_draft_assets items WHERE items.draft_uuid = tochukwu_meta_ad_drafts.draft_uuid) AS assetCount
    FROM tochukwu_meta_ad_drafts ORDER BY created_at DESC LIMIT ${safeLimit}
  `)
  return rows.map((row) => {
    let primaryTexts = [row.primaryText]
    try {
      const parsed = JSON.parse(String((row as MetaAdDraft & { primaryTextsJson?: string | null }).primaryTextsJson || ""))
      if (Array.isArray(parsed) && parsed.every((value) => typeof value === "string")) primaryTexts = parsed
    } catch {}
    return { ...row, primaryTexts, dailyBudgetMinor: Number(row.dailyBudgetMinor), assetCount: Number(row.assetCount || 0) }
  })
}

async function updateProviderId(draftUuid: string, field: "campaign_id" | "adset_id" | "creative_id" | "ad_id", value: string) {
  await prisma.$executeRawUnsafe(`UPDATE tochukwu_meta_ad_drafts SET ${field} = ?, updated_at = ? WHERE draft_uuid = ?`, value, new Date(), draftUuid)
}

export async function createPausedPromptToProfitCampaign(rawInput: DraftInput, actor: Actor) {
  await ensureMetaAdsCampaignTables()
  const input = validateDraftInput(rawInput)
  await assertMetaAdsDailyBudget(input.dailyBudgetMinor)
  const assets = await discoverMetaAdsAssets()
  if (!assets.pages.some((item) => item.id === input.pageId)) throw new Error("The selected Facebook Page is not assigned to this ad account.")
  if (!assets.pixels.some((item) => item.id === input.pixelId)) throw new Error("The selected Purchase pixel is not assigned to this ad account.")
  if (input.instagramActorId && !assets.instagramAccounts.some((item) => item.id === input.instagramActorId)) throw new Error("The selected Instagram account is not assigned to this ad account.")
  const resolvedMedia = input.media.map((item) => {
    if (item.type === "image") {
      const asset = assets.images.find((candidate) => candidate.hash === item.id)
      if (!asset) throw new Error("A selected image is no longer available in this Meta ad account.")
      return { type: "image" as const, id: item.id, previewUrl: safePreviewUrl(asset.url) }
    }
    const asset = assets.videos.find((candidate) => candidate.id === item.id)
    if (!asset) throw new Error("A selected video is no longer available in this Meta ad account.")
    return { type: "video" as const, id: item.id, previewUrl: safePreviewUrl(asset.thumbnailUrl) }
  })
  const firstMedia = resolvedMedia[0]

  const draftUuid = randomUUID()
  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO tochukwu_meta_ad_drafts (
      draft_uuid, status, campaign_name, daily_budget_minor, country_code, age_min, age_max,
      primary_text, primary_texts_json, headline, description, image_url, media_type, image_hash, video_id, call_to_action, page_id,
      instagram_actor_id, pixel_id, created_by, created_at, updated_at
    ) VALUES (
      ${draftUuid}, ${"creating"}, ${input.campaignName}, ${input.dailyBudgetMinor}, ${input.countryCode}, ${input.ageMin}, ${input.ageMax},
      ${input.primaryTexts[0]}, ${JSON.stringify(input.primaryTexts)}, ${input.headline}, ${input.description || null}, ${firstMedia.previewUrl}, ${firstMedia.type}, ${firstMedia.type === "image" ? firstMedia.id : null}, ${firstMedia.type === "video" ? firstMedia.id : null}, ${input.callToAction}, ${input.pageId},
      ${input.instagramActorId || null}, ${input.pixelId}, ${actor.email || actor.adminUuid}, ${now}, ${now}
    )
  `
  for (const [position, media] of resolvedMedia.entries()) {
    await prisma.$executeRaw`
      INSERT INTO tochukwu_meta_ad_draft_assets (
        item_uuid, draft_uuid, item_position, media_type, image_hash, video_id, preview_url, created_at, updated_at
      ) VALUES (
        ${randomUUID()}, ${draftUuid}, ${position}, ${media.type}, ${media.type === "image" ? media.id : null},
        ${media.type === "video" ? media.id : null}, ${media.previewUrl || null}, ${now}, ${now}
      )
    `
  }
  await audit(draftUuid, "draft_creation_started", actor, { destinationUrl: PROMPT_TO_PROFIT_URL, objective: PROMPT_TO_PROFIT_OBJECTIVE, dailyBudgetMinor: input.dailyBudgetMinor, assetCount: resolvedMedia.length, targetCountry: input.countryCode })

  try {
    const { accountId } = await getMetaAdsApiConfiguration()
    const campaign = await metaAdsRequest<{ id: string }>(`act_${accountId}/campaigns`, {
      method: "POST",
      params: { name: input.campaignName, objective: PROMPT_TO_PROFIT_OBJECTIVE, status: "PAUSED", buying_type: "AUCTION", special_ad_categories: "[]" }
    })
    await updateProviderId(draftUuid, "campaign_id", campaign.id)

    const adset = await metaAdsRequest<{ id: string }>(`act_${accountId}/adsets`, {
      method: "POST",
      params: {
        name: `${input.campaignName} | ${input.countryCode} ${input.ageMin}-${input.ageMax}`,
        campaign_id: campaign.id,
        daily_budget: input.dailyBudgetMinor,
        billing_event: "IMPRESSIONS",
        optimization_goal: "OFFSITE_CONVERSIONS",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        destination_type: "WEBSITE",
        promoted_object: JSON.stringify({ pixel_id: input.pixelId, custom_event_type: "PURCHASE" }),
        targeting: JSON.stringify({ geo_locations: { countries: [input.countryCode] }, age_min: input.ageMin, age_max: input.ageMax }),
        status: "PAUSED"
      }
    })
    await updateProviderId(draftUuid, "adset_id", adset.id)

    const objectStorySpec: Record<string, unknown> = { page_id: input.pageId }
    if (input.instagramActorId) objectStorySpec.instagram_actor_id = input.instagramActorId
    const images = resolvedMedia.flatMap((media) => media.type === "image" ? [{ hash: media.id }] : [])
    const videos = resolvedMedia.flatMap((media) => media.type === "video"
      ? [{ video_id: media.id, ...(media.previewUrl ? { thumbnail_url: media.previewUrl } : {}) }]
      : [])
    const assetFeedSpec = {
      ad_formats: ["AUTOMATIC_FORMAT"],
      bodies: input.primaryTexts.map((text) => ({ text })),
      titles: [{ text: input.headline }],
      ...(input.description ? { descriptions: [{ text: input.description }] } : {}),
      link_urls: [{ website_url: PROMPT_TO_PROFIT_URL }],
      call_to_action_types: [input.callToAction],
      call_to_actions: [{ type: input.callToAction }],
      ...(images.length ? { images } : {}),
      ...(videos.length ? { videos } : {})
    }
    const creative = await metaAdsRequest<{ id: string }>(`act_${accountId}/adcreatives`, {
      method: "POST",
      params: {
        name: `${input.campaignName} | Flexible creative`,
        object_story_spec: JSON.stringify(objectStorySpec),
        asset_feed_spec: JSON.stringify(assetFeedSpec)
      }
    })
    await updateProviderId(draftUuid, "creative_id", creative.id)
    const ad = await metaAdsRequest<{ id: string }>(`act_${accountId}/ads`, {
      method: "POST",
      params: { name: `${input.campaignName} | Flexible ad`, adset_id: adset.id, creative: JSON.stringify({ creative_id: creative.id }), status: "PAUSED" }
    })
    await updateProviderId(draftUuid, "ad_id", ad.id)
    await prisma.$executeRaw`UPDATE tochukwu_meta_ad_drafts SET status = ${"paused"}, last_error = NULL, updated_at = ${new Date()} WHERE draft_uuid = ${draftUuid}`
    await audit(draftUuid, "paused_campaign_created", actor, {
      campaignId: campaign.id,
      adsetId: adset.id,
      creativeId: creative.id,
      adId: ad.id,
      assetCount: resolvedMedia.length,
      assets: resolvedMedia.map((media) => ({ type: media.type, id: media.id }))
    })
    return { draftUuid, status: "paused" }
  } catch (error) {
    const message = safeMetaAdsError(error)
    await prisma.$executeRaw`UPDATE tochukwu_meta_ad_drafts SET status = ${"failed"}, last_error = ${message}, updated_at = ${new Date()} WHERE draft_uuid = ${draftUuid}`
    await audit(draftUuid, "draft_creation_failed", actor, { error: message })
    throw new Error(`${message} Any provider objects already created remain paused.`)
  }
}

async function getDraft(draftUuid: string) {
  await ensureMetaAdsCampaignTables()
  const rows = await prisma.$queryRaw<Array<MetaAdDraft>>`
    SELECT draft_uuid AS draftUuid, status, campaign_name AS campaignName,
      CAST(daily_budget_minor AS SIGNED) AS dailyBudgetMinor, country_code AS countryCode,
      age_min AS ageMin, age_max AS ageMax, primary_text AS primaryText, headline,
      description, image_url AS imageUrl, media_type AS mediaType, image_hash AS imageHash,
      video_id AS videoId, call_to_action AS callToAction, page_id AS pageId,
      instagram_actor_id AS instagramActorId, pixel_id AS pixelId, campaign_id AS campaignId,
      adset_id AS adsetId, creative_id AS creativeId, ad_id AS adId, last_error AS lastError,
      created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
    FROM tochukwu_meta_ad_drafts WHERE draft_uuid = ${draftUuid} LIMIT 1
  `
  if (!rows[0]) throw new Error("Meta campaign draft was not found.")
  return rows[0]
}

async function setRemoteStatus(id: string | null, status: "ACTIVE" | "PAUSED") {
  if (!id) throw new Error("A required Meta campaign object is missing.")
  await metaAdsRequest<{ success?: boolean }>(id, { method: "POST", params: { status } })
}

export async function publishMetaAdDraft(draftUuidValue: string, confirmationValue: string, actor: Actor) {
  const draftUuid = clean(draftUuidValue, 80)
  const draft = await getDraft(draftUuid)
  if (!draft.campaignId || !draft.adsetId || !draft.adId) throw new Error("The Meta campaign, ad set or ad ID is missing.")
  if (confirmationValue !== draft.campaignName) throw new Error("Type the exact campaign name to confirm publishing.")
  await assertMetaAdsDailyBudget(Number(draft.dailyBudgetMinor))
  const assets = await discoverMetaAdsAssets()
  if (assets.account.currency !== "NGN") throw new Error("Publishing is locked because the account currency changed.")
  const locked = await prisma.$executeRaw`UPDATE tochukwu_meta_ad_drafts SET status = ${"publishing"}, updated_at = ${new Date()} WHERE draft_uuid = ${draftUuid} AND status = ${"paused"}`
  if (Number(locked) !== 1) throw new Error("Only a complete paused campaign can be published.")
  await audit(draftUuid, "publish_started", actor)
  const activated: string[] = []
  try {
    await setRemoteStatus(draft.adId, "ACTIVE"); activated.push(draft.adId)
    await setRemoteStatus(draft.adsetId, "ACTIVE"); activated.push(draft.adsetId)
    await setRemoteStatus(draft.campaignId, "ACTIVE"); activated.push(draft.campaignId)
    await prisma.$executeRaw`UPDATE tochukwu_meta_ad_drafts SET status = ${"active"}, published_at = ${new Date()}, last_error = NULL, updated_at = ${new Date()} WHERE draft_uuid = ${draftUuid}`
    await audit(draftUuid, "campaign_published", actor, { campaignId: draft.campaignId })
    return { draftUuid, status: "active" }
  } catch (error) {
    await Promise.allSettled(activated.map((id) => setRemoteStatus(id, "PAUSED")))
    const message = safeMetaAdsError(error)
    await prisma.$executeRaw`UPDATE tochukwu_meta_ad_drafts SET status = ${"paused"}, last_error = ${message}, updated_at = ${new Date()} WHERE draft_uuid = ${draftUuid}`
    await audit(draftUuid, "publish_rolled_back", actor, { error: message })
    throw new Error(`${message} Every object activated by this attempt was returned to paused.`)
  }
}

export async function pauseMetaAdDraft(draftUuidValue: string, actor: Actor) {
  const draftUuid = clean(draftUuidValue, 80)
  const draft = await getDraft(draftUuid)
  if (!draft.campaignId || !draft.adId) throw new Error("The Meta campaign or ad ID is missing.")
  await setRemoteStatus(draft.campaignId, "PAUSED")
  await Promise.allSettled([setRemoteStatus(draft.adsetId, "PAUSED"), setRemoteStatus(draft.adId, "PAUSED")])
  await prisma.$executeRaw`UPDATE tochukwu_meta_ad_drafts SET status = ${"paused"}, updated_at = ${new Date()} WHERE draft_uuid = ${draftUuid}`
  await audit(draftUuid, "campaign_paused", actor, { campaignId: draft.campaignId })
  return { draftUuid, status: "paused" }
}

"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { AlertTriangle, Database, ExternalLink, FileText, History, ImageIcon, Loader2, LockKeyhole, Megaphone, PauseCircle, RefreshCw, Rocket, ShieldCheck, Target, Video, WalletCards } from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"

type Asset = { id: string; name: string }
type ImageAsset = { hash: string; name: string; url: string; width: number | null; height: number | null }
type VideoAsset = { id: string; name: string; thumbnailUrl: string; sourceUrl: string }
type Assets = {
  account: { id: string; name: string; currency: string; status: number }
  pages: Asset[]
  instagramAccounts: Asset[]
  pixels: Asset[]
  images: ImageAsset[]
  videos: VideoAsset[]
}
type Draft = {
  draftUuid: string
  status: string
  campaignName: string
  dailyBudgetMinor: number
  countryCode: string
  ageMin: number
  ageMax: number
  headline: string
  mediaType: "image" | "video"
  campaignId: string | null
  adsetId: string | null
  creativeId: string | null
  adId: string | null
  lastError: string | null
  createdAt: string
  assetCount: number
}

const DESTINATION = "https://www.tochukwunkwocha.com/courses/prompt-to-profit"
const PRIMARY_TEXT_OPTIONS = [
  {
    angle: "Direct transformation",
    text: `Stop using AI only to write messages. Learn to use it to build and publish a real website or digital tool in 5 guided days—without coding experience.

Prompt to Profit gives you recorded lessons, two live Zoom classes, practical project support and one full year of access.

See the programme and choose your August cohort.`
  },
  {
    angle: "Proof and credibility",
    text: `Can a complete beginner really build useful things with AI?

More than 350 learners across three cohorts have already taken this practical path. Students have published business websites, portfolio pages, games and simple digital tools. One parent reported that her 8-year-old had built three practice websites by Day 3.

Prompt to Profit is a 5-day, beginner-friendly programme with recorded lessons, two live Zoom classes, project support, one year of access and a verified certificate after completing and submitting your project.

Explore the programme and secure a place in an August cohort.`
  },
  {
    angle: "Objection handling",
    text: `You do not need to be a “tech person” to build with AI.

If you can use a browser, type and follow clear instructions, Prompt to Profit will guide you from a blank screen to a live website and a simple digital tool. You will learn how to direct AI, improve what it produces, fix mistakes and publish work you can actually show people.

The programme combines step-by-step recorded lessons with live Zoom support, project feedback and one full year of access.

See exactly what you will build in 5 days.`
  },
  {
    angle: "Parents and young learners",
    text: `Give a young learner more than screen time. Give them the confidence to create with technology.

Prompt to Profit helps children from about age 8, teenagers and complete beginners use AI to build websites, games, calculators and creative project pages—without needing to learn coding first.

Lessons are recorded and easy to replay, with two live Zoom classes for questions and support. Learners keep access for one full year and can earn a verified certificate after completing their project.

Explore the August cohorts for your child—or learn alongside them.`
  },
  {
    angle: "Career and business outcomes",
    text: `Stop only saying you can use AI. Build something you can show.

In Prompt to Profit, complete beginners learn to create and publish websites, landing pages, portfolios and useful digital tools with AI. That can become proof for an employer, a starting point for a business idea or a practical skill you use to help clients.

You get a guided 5-day learning path, recorded lessons, two live Zoom classes, project support, one year of access and a verified certificate tied to completed work.

Review the programme and choose your August cohort.`
  }
] as const
const DASHBOARD_INPUT = "brand-focus h-12 rounded-lg border border-input bg-background px-4 text-sm font-semibold text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground hover:border-primary/40 focus:border-primary focus:ring-1 focus:ring-primary"
const DASHBOARD_TEXTAREA = "brand-focus rounded-lg border border-input bg-background px-4 py-3 text-sm font-semibold text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground hover:border-primary/40 focus:border-primary focus:ring-1 focus:ring-primary"
const TARGET_COUNTRIES = [
  { value: "NG", label: "Nigeria (NG)" },
  { value: "GB", label: "United Kingdom (GB)" },
  { value: "US", label: "United States (US)" },
  { value: "CA", label: "Canada (CA)" },
  { value: "GH", label: "Ghana (GH)" },
  { value: "ZA", label: "South Africa (ZA)" }
]

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init })
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null
  if (!response.ok || !payload) throw new Error(payload?.error || "The request could not be completed.")
  return payload
}

export function MetaAdsCampaignBuilder({ isOwner }: { isOwner: boolean }) {
  const [assets, setAssets] = useState<Assets | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState("")
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null)
  const [publishConfirmation, setPublishConfirmation] = useState<Record<string, string>>({})
  const [selectedMediaKeys, setSelectedMediaKeys] = useState<string[]>([])
  const [targetCountry, setTargetCountry] = useState("NG")

  const load = useCallback(async () => {
    if (!isOwner) return
    setLoading(true)
    setMessage(null)
    try {
      const [assetResult, draftResult] = await Promise.all([
        jsonRequest<{ assets: Assets }>("/api/internal/meta-ads/assets"),
        jsonRequest<{ drafts: Draft[] }>("/api/internal/meta-ads/drafts")
      ])
      setAssets(assetResult.assets)
      const availableKeys = new Set([
        ...assetResult.assets.images.map((item) => `image:${item.hash}`),
        ...assetResult.assets.videos.map((item) => `video:${item.id}`)
      ])
      setSelectedMediaKeys((current) => {
        const retained = current.filter((key) => availableKeys.has(key)).slice(0, 10)
        if (retained.length) return retained
        const first = availableKeys.values().next().value
        return first ? [first] : []
      })
      setDrafts(draftResult.drafts)
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not load Meta campaign controls." })
    } finally {
      setLoading(false)
    }
  }, [isOwner])

  useEffect(() => { void load() }, [load])

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (!selectedMediaKeys.length) {
      setMessage({ kind: "error", text: "Select at least one image or video from the Meta media library." })
      return
    }
    setWorking("create")
    setMessage(null)
    try {
      await jsonRequest("/api/internal/meta-ads/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: form.get("campaignName"),
          dailyBudgetMinor: Math.round(Number(form.get("dailyBudgetNgn")) * 100),
          countryCode: form.get("countryCode"),
          ageMin: Number(form.get("ageMin")),
          ageMax: Number(form.get("ageMax")),
          primaryTexts: form.getAll("primaryText"),
          headline: form.get("headline"),
          description: form.get("description"),
          media: selectedMediaKeys.map((key) => {
            const [type, id] = key.split(":", 2)
            return { type, id }
          }),
          callToAction: form.get("callToAction"),
          pageId: form.get("pageId"),
          instagramActorId: form.get("instagramActorId"),
          pixelId: form.get("pixelId")
        })
      })
      setMessage({ kind: "success", text: "The complete Meta campaign was created in PAUSED state. Review it below before publishing." })
      await load()
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not create the paused campaign." })
    } finally {
      setWorking("")
    }
  }

  async function publish(draft: Draft) {
    setWorking(`publish:${draft.draftUuid}`)
    setMessage(null)
    try {
      await jsonRequest(`/api/internal/meta-ads/drafts/${encodeURIComponent(draft.draftUuid)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: publishConfirmation[draft.draftUuid] || "" })
      })
      setMessage({ kind: "success", text: `“${draft.campaignName}” is active.` })
      await load()
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not publish the campaign." })
    } finally {
      setWorking("")
    }
  }

  async function pause(draft: Draft) {
    setWorking(`pause:${draft.draftUuid}`)
    setMessage(null)
    try {
      await jsonRequest(`/api/internal/meta-ads/drafts/${encodeURIComponent(draft.draftUuid)}/pause`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      setMessage({ kind: "success", text: `“${draft.campaignName}” was paused.` })
      await load()
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not pause the campaign." })
    } finally {
      setWorking("")
    }
  }

  if (!isOwner) {
    return <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"><p className="eyebrow text-primary">Meta campaign publishing</p><h2 className="mt-1 font-heading text-xl font-black text-foreground">Owner approval required</h2><p className="mt-2 text-sm text-muted-foreground">Marketing staff can view reporting, but only the owner can create, activate or pause paid campaigns.</p></section>
  }

  const hasMedia = Boolean(assets?.images.length || assets?.videos.length)

  function toggleMedia(key: string) {
    setSelectedMediaKeys((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key)
      if (current.length >= 10) {
        setMessage({ kind: "error", text: "Select no more than 10 assets for one flexible advert." })
        return current
      }
      return [...current, key]
    })
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Megaphone className="h-5 w-5" /></span>
            <div className="min-w-0"><p className="eyebrow text-primary">Meta campaign workspace</p><h2 className="mt-1 font-heading text-xl font-black text-foreground">Prompt to Profit direct purchase</h2><p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">Build a Purchase-optimised Meta campaign, review every provider object in a paused state, then activate it through a separate owner approval.</p></div>
          </div>
          <a href={DESTINATION} target="_blank" rel="noreferrer" className="btn-secondary w-full justify-center shadow-sm sm:w-auto"><ExternalLink className="mr-2 h-4 w-4" />Review course page</a>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Objective</p><p className="mt-1 font-heading text-sm font-black text-foreground">Sales · Purchase</p></div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Daily ceiling</p><p className="mt-1 font-heading text-sm font-black text-foreground">₦20,000</p></div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Target country</p><p className="mt-1 font-heading text-sm font-black text-foreground">{TARGET_COUNTRIES.find((country) => country.value === targetCountry)?.label || targetCountry}</p></div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Creation state</p><p className="mt-1 font-heading text-sm font-black text-amber-600 dark:text-amber-400">Paused by default</p></div>
          <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Destination</p><p className="mt-1 truncate font-mono text-xs font-bold text-primary" title={DESTINATION}>{DESTINATION}</p></div>
        </div>
      </div>

      {message ? <div className={`flex items-start gap-3 border-b px-6 py-4 text-sm font-semibold sm:px-8 ${message.kind === "error" ? "border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-300" : "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"}`}>{message.kind === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />}<span>{message.text}</span></div> : null}

      {loading ? <div className="flex min-h-40 items-center justify-center gap-3 bg-background/40 p-8 text-sm font-semibold text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" />Loading assigned Meta assets…</div> : assets ? (
        <form onSubmit={createDraft} className="space-y-6 bg-background/40 p-4 sm:p-6 lg:p-8">
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-3 border-b border-border bg-muted/15 p-5 sm:px-6"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><WalletCards className="h-4 w-4" /></span><div><h3 className="font-heading text-base font-black text-foreground">Campaign controls</h3><p className="text-xs font-medium text-muted-foreground">Name the campaign and set its controlled daily spend.</p></div></div>
            <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
              <label className="block min-w-0"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Campaign name</span><input name="campaignName" required maxLength={180} defaultValue={`Prompt to Profit | Direct Purchase | ${new Date().toISOString().slice(0, 10)}`} className={`${DASHBOARD_INPUT} w-full`} /></label>
              <label className="block min-w-0"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Daily budget (NGN)</span><input name="dailyBudgetNgn" required type="number" min="1" max="20000" step="1" defaultValue="20000" className={`${DASHBOARD_INPUT} w-full`} /><span className="mt-2 block text-[11px] font-medium text-muted-foreground">The server rejects any amount above ₦20,000/day.</span></label>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-3 border-b border-border bg-muted/15 p-5 sm:px-6"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400"><Database className="h-4 w-4" /></span><div><h3 className="font-heading text-base font-black text-foreground">Delivery identities and media</h3><p className="text-xs font-medium text-muted-foreground">Choose only assets already assigned to iSimplifyAds.</p></div></div>
            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-3">
              <label className="block min-w-0"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Facebook Page</span><PremiumPicker name="pageId" required placeholder={assets.pages.length ? "Select Facebook Page" : "No assigned Facebook Page found"} options={assets.pages.map((asset) => ({ value: asset.id, label: `${asset.name} (${asset.id})` }))} />{!assets.pages.length ? <span className="mt-2 block text-[11px] font-semibold text-red-600 dark:text-red-400">Meta did not return a Page assigned for advertising.</span> : null}</label>
              <label className="block min-w-0"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Instagram identity</span><PremiumPicker name="instagramActorId" options={[{ value: "", label: "Facebook Page only" }, ...assets.instagramAccounts.map((asset) => ({ value: asset.id, label: `${asset.name} (${asset.id})` }))]} /></label>
              <label className="block min-w-0"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Purchase pixel / dataset</span><PremiumPicker name="pixelId" required options={assets.pixels.map((asset) => ({ value: asset.id, label: `${asset.name} (${asset.id})` }))} /></label>
            </div>
            <div className="border-t border-border bg-muted/10 p-5 sm:p-6">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Flexible creative set</p><h4 className="mt-1 font-heading text-base font-black text-foreground">Select up to 10 images and videos</h4><p className="mt-1 text-xs font-medium text-muted-foreground">The selected assets are combined in one flexible advert so Meta can match the most relevant creative to each person.</p></div><span className="w-fit rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-primary">{selectedMediaKeys.length}/10 selected</span></div>
              <div className="grid max-h-[42rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {assets.images.map((asset) => {
                  const key = `image:${asset.hash}`
                  const selected = selectedMediaKeys.includes(key)
                  return <button key={key} type="button" aria-pressed={selected} onClick={() => toggleMedia(key)} className={`group overflow-hidden rounded-xl border bg-card text-left shadow-sm transition ${selected ? "border-primary ring-2 ring-primary/15" : "border-border hover:border-primary/40"}`}><div className="aspect-video bg-muted bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${JSON.stringify(asset.url).slice(1, -1)})` }} /><div className="p-3"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" />Image</span><span className={`h-4 w-4 rounded-full border-2 ${selected ? "border-primary bg-primary shadow-[inset_0_0_0_3px_hsl(var(--card))]" : "border-border"}`} /></div><p className="mt-2 truncate text-xs font-bold text-foreground" title={asset.name}>{asset.name}</p><p className="mt-1 text-[10px] text-muted-foreground">{asset.width && asset.height ? `${asset.width}×${asset.height}` : "Meta image"}</p></div></button>
                })}
                {assets.videos.map((asset) => {
                  const key = `video:${asset.id}`
                  const selected = selectedMediaKeys.includes(key)
                  return <button key={key} type="button" aria-pressed={selected} onClick={() => toggleMedia(key)} className={`group overflow-hidden rounded-xl border bg-card text-left shadow-sm transition ${selected ? "border-primary ring-2 ring-primary/15" : "border-border hover:border-primary/40"}`}><div className="relative aspect-video bg-black/90 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${JSON.stringify(asset.thumbnailUrl).slice(1, -1)})` }}><span className="absolute inset-0 flex items-center justify-center"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white"><Video className="h-4 w-4" /></span></span></div><div className="p-3"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><Video className="h-3.5 w-3.5" />Video</span><span className={`h-4 w-4 rounded-full border-2 ${selected ? "border-primary bg-primary shadow-[inset_0_0_0_3px_hsl(var(--card))]" : "border-border"}`} /></div><p className="mt-2 truncate text-xs font-bold text-foreground" title={asset.name}>{asset.name}</p><p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">ID {asset.id}</p></div></button>
                })}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-3 border-b border-border bg-muted/15 p-5 sm:px-6"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><Target className="h-4 w-4" /></span><div><h3 className="font-heading text-base font-black text-foreground">Audience and conversion message</h3><p className="text-xs font-medium text-muted-foreground">Expert starting copy focused on the beginner’s problem, concrete transformation, programme delivery and a truthful next step.</p></div></div>
            <div className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                <label className="min-w-0"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Target country</span><PremiumPicker name="countryCode" value={targetCountry} onChange={(event) => setTargetCountry(event.target.value)} required options={TARGET_COUNTRIES} /></label>
                <label className="min-w-0"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Minimum age</span><input name="ageMin" required type="number" min="18" max="65" defaultValue="21" className={`${DASHBOARD_INPUT} w-full`} /></label>
                <label className="min-w-0"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Maximum age</span><input name="ageMax" required type="number" min="18" max="65" defaultValue="55" className={`${DASHBOARD_INPUT} w-full`} /></label>
                <label className="min-w-0"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Call to action</span><PremiumPicker name="callToAction" options={[{ value: "LEARN_MORE", label: "Learn more" }, { value: "SIGN_UP", label: "Sign up" }]} /></label>
              </div>
              <div className="space-y-4">
                <div><span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"><FileText className="h-3.5 w-3.5" />Primary-text options</span><p className="mt-2 text-xs font-medium leading-relaxed text-muted-foreground">Five distinct hooks give Meta meaningful message diversity—not cosmetic rewrites. Every opening line carries the core idea before feed truncation.</p></div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {PRIMARY_TEXT_OPTIONS.map((option, index) => <label key={option.angle} className={`block min-w-0 rounded-xl border border-border bg-muted/10 p-4 ${index === PRIMARY_TEXT_OPTIONS.length - 1 ? "xl:col-span-2" : ""}`}><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-primary">Option {index + 1} · {option.angle}</span><textarea name="primaryText" required rows={8} maxLength={1250} defaultValue={option.text} className={`${DASHBOARD_TEXTAREA} min-h-52 w-full resize-y leading-relaxed`} /></label>)}
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2"><label className="min-w-0"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Headline</span><input name="headline" required maxLength={255} defaultValue="Build Real Websites and Digital Tools with AI" className={`${DASHBOARD_INPUT} w-full`} /></label><label className="min-w-0"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description</span><input name="description" maxLength={255} defaultValue="5 guided days · Beginner-friendly · Live support" className={`${DASHBOARD_INPUT} w-full`} /></label></div>
            </div>
          </section>

          <div className="flex flex-col gap-4 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400"><LockKeyhole className="h-4 w-4" /></span><div><p className="font-heading text-sm font-black text-foreground">Protected paused creation</p><p className="mt-1 max-w-2xl text-xs font-medium leading-relaxed text-muted-foreground">One campaign, one ad set, one multi-asset creative and one paused advert are created. Partial failures are recorded and cannot begin spending.</p></div></div><button type="submit" disabled={working === "create" || !assets.pages.length || !assets.pixels.length || !selectedMediaKeys.length} className="btn-primary w-full justify-center shadow-sm lg:w-auto">{working === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}{working === "create" ? "Creating paused campaign…" : "Create paused flexible advert"}</button></div>
          {!assets.pages.length || !assets.pixels.length || !hasMedia ? <p className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm font-semibold text-red-600 dark:text-red-400"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />A Facebook Page, Purchase pixel, and at least one existing image or video must be available before campaign creation is enabled.</p> : null}
        </form>
      ) : null}

      <div className="border-t border-border bg-muted/10">
        <div className="flex flex-col gap-4 border-b border-border bg-muted/20 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><History className="h-5 w-5" /></span><div><h3 className="font-heading text-xl font-black text-foreground">Campaign approval ledger</h3><p className="mt-1 text-sm font-medium text-muted-foreground">Paused drafts, activation state and provider references.</p></div></div><button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary w-full justify-center shadow-sm sm:w-auto"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button></div>
        <div className="space-y-4 p-4 sm:p-6 lg:p-8">
          {drafts.length ? drafts.map((draft) => (
            <article key={draft.draftUuid} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors hover:border-primary/30">
              <div className="p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h4 className="truncate font-heading text-base font-black text-foreground" title={draft.campaignName}>{draft.campaignName}</h4><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"><span>₦{new Intl.NumberFormat("en-NG").format(Number(draft.dailyBudgetMinor) / 100)}/day</span><span>{TARGET_COUNTRIES.find((country) => country.value === draft.countryCode)?.label || draft.countryCode}</span><span>Ages {draft.ageMin}–{draft.ageMax}</span><span>{draft.assetCount || 1} asset{Number(draft.assetCount || 1) === 1 ? "" : "s"} · 1 advert</span></div></div><span className={`w-fit rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm ${draft.status === "active" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : draft.status === "failed" ? "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400" : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>{draft.status}</span></div><div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2"><div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Campaign ID</p><p className="mt-1 truncate font-mono text-xs font-semibold text-foreground">{draft.campaignId || "Not created"}</p></div><div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Advert ID</p><p className="mt-1 truncate font-mono text-xs font-semibold text-foreground">{draft.adId || "Not created"}</p></div></div>{draft.lastError ? <p className="mt-4 rounded-lg border border-red-500/15 bg-red-500/5 p-3 text-xs font-medium text-red-700 dark:text-red-300">{draft.lastError}</p> : null}</div>
              {draft.status === "paused" && draft.adId ? <div className="flex flex-col gap-3 border-t border-border bg-muted/10 p-4 sm:flex-row sm:p-5"><input value={publishConfirmation[draft.draftUuid] || ""} onChange={(event) => setPublishConfirmation((current) => ({ ...current, [draft.draftUuid]: event.target.value }))} placeholder={`Type: ${draft.campaignName}`} className={`${DASHBOARD_INPUT} min-w-0 flex-1`} /><button type="button" onClick={() => void publish(draft)} disabled={working === `publish:${draft.draftUuid}`} className="btn-primary w-full shrink-0 justify-center shadow-sm sm:w-auto">{working === `publish:${draft.draftUuid}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}Publish campaign</button></div> : null}
              {draft.status === "active" ? <div className="border-t border-border bg-muted/10 p-4 sm:p-5"><button type="button" onClick={() => void pause(draft)} disabled={working === `pause:${draft.draftUuid}`} className="btn-secondary w-full justify-center text-red-600 shadow-sm sm:w-auto"><PauseCircle className="mr-2 h-4 w-4" />Emergency pause</button></div> : null}
            </article>
          )) : <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-14 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"><History className="h-5 w-5" /></span><h4 className="mt-4 font-heading text-base font-black text-foreground">No campaign drafts</h4><p className="mt-1 text-sm font-medium text-muted-foreground">Paused Meta campaigns will appear here for owner approval.</p></div>}
        </div>
      </div>
    </section>
  )
}

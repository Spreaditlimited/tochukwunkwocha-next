import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 240)
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value)
    return parsed == null ? fallback : (parsed as T)
  } catch {
    return fallback
  }
}

export function stripHtml(value: string | null | undefined) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function excerptFrom(content: string | null | undefined, explicit?: string | null) {
  const cleanExplicit = String(explicit || "").trim()
  if (cleanExplicit) return cleanExplicit.slice(0, 320)
  return stripHtml(content).slice(0, 220)
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date)
}

export function formatDateTimeWAT(value: Date | string | null | undefined) {
  if (!value) return ""
  const raw = value instanceof Date
    ? [
        value.getUTCFullYear(),
        String(value.getUTCMonth() + 1).padStart(2, "0"),
        String(value.getUTCDate()).padStart(2, "0")
      ].join("-") + `T${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}:00`
    : String(value || "").trim()
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  const date = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5])))
    : new Date(raw)
  if (!Number.isFinite(date.getTime())) return ""
  return `${new Intl.DateTimeFormat("en-GB", {
    timeZone: match ? "UTC" : "Africa/Lagos",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date)} WAT`
}

export function watWallDateTimeMs(value: Date | string | null | undefined) {
  if (!value) return NaN
  if (value instanceof Date) {
    const ms = Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      value.getUTCHours() - 1,
      value.getUTCMinutes(),
      value.getUTCSeconds()
    )
    return Number.isFinite(ms) ? ms : NaN
  }
  const raw = String(value || "").trim()
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (match) {
    const ms = Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]) - 1,
      Number(match[5]),
      Number(match[6] || "0")
    )
    return Number.isFinite(ms) ? ms : NaN
  }
  const ms = new Date(raw).getTime()
  return Number.isFinite(ms) ? ms : NaN
}

export function batchHasNotStarted(
  batchStartAt: Date | string | null | undefined,
  currentTimeMs = Date.now()
) {
  if (!batchStartAt || !Number.isFinite(currentTimeMs)) return false

  const batchDateKey = (() => {
    if (batchStartAt instanceof Date) {
      if (!Number.isFinite(batchStartAt.getTime())) return ""
      return [
        batchStartAt.getUTCFullYear(),
        String(batchStartAt.getUTCMonth() + 1).padStart(2, "0"),
        String(batchStartAt.getUTCDate()).padStart(2, "0")
      ].join("-")
    }
    const raw = String(batchStartAt).trim()
    const wallDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (wallDate) return `${wallDate[1]}-${wallDate[2]}-${wallDate[3]}`
    const parsed = new Date(raw)
    if (!Number.isFinite(parsed.getTime())) return ""
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(parsed)
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ""
    return `${value("year")}-${value("month")}-${value("day")}`
  })()

  const currentParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(currentTimeMs))
  const currentValue = (type: Intl.DateTimeFormatPartTypes) => currentParts.find((part) => part.type === type)?.value || ""
  const currentDateKey = `${currentValue("year")}-${currentValue("month")}-${currentValue("day")}`

  return Boolean(batchDateKey) && batchDateKey > currentDateKey
}

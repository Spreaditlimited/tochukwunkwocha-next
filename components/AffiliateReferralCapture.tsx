"use client"

import { useEffect } from "react"

export const AFFILIATE_REF_STORAGE_KEY = "tn_affiliate_ref_code_v1"
export const AFFILIATE_REF_CAPTURED_AT_KEY = "tn_affiliate_ref_captured_at_v1"
export const AFFILIATE_REF_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function storeAffiliateReferralCode(value: string) {
  const code = String(value || "").trim().toUpperCase().slice(0, 40)
  if (!code) return ""
  window.localStorage.setItem(AFFILIATE_REF_STORAGE_KEY, code)
  window.localStorage.setItem(AFFILIATE_REF_CAPTURED_AT_KEY, String(Date.now()))
  return code
}

export function readAffiliateReferralCode() {
  const code = String(window.localStorage.getItem(AFFILIATE_REF_STORAGE_KEY) || "").trim().toUpperCase().slice(0, 40)
  const capturedAt = Number(window.localStorage.getItem(AFFILIATE_REF_CAPTURED_AT_KEY) || 0)
  if (!code || !capturedAt || Date.now() - capturedAt > AFFILIATE_REF_TTL_MS) {
    window.localStorage.removeItem(AFFILIATE_REF_STORAGE_KEY)
    window.localStorage.removeItem(AFFILIATE_REF_CAPTURED_AT_KEY)
    return ""
  }
  return code
}

export function AffiliateReferralCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const code = String(params.get("ref") || params.get("affiliate") || params.get("affiliateCode") || "")
        .trim()
        .toUpperCase()
        .slice(0, 40)
      if (code) storeAffiliateReferralCode(code)
    } catch {
      // Referral persistence is best-effort and must not interfere with page rendering.
    }
  }, [])

  return null
}

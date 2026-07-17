"use client"

import { useEffect } from "react"

export const AFFILIATE_REF_STORAGE_KEY = "tn_affiliate_ref_code_v1"

export function AffiliateReferralCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const code = String(params.get("ref") || params.get("affiliate") || "")
        .trim()
        .toUpperCase()
        .slice(0, 40)
      if (code) window.localStorage.setItem(AFFILIATE_REF_STORAGE_KEY, code)
    } catch {
      // Referral persistence is best-effort and must not interfere with page rendering.
    }
  }, [])

  return null
}

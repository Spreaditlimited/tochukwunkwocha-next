"use client"

import { useEffect, useState } from "react"

const STORAGE_KEY = "school_dashboard_welcome_notice_v1"
const NOTICE_TTL_MS = 5 * 60 * 1000
const MESSAGE =
  "Welcome to Prompt to Profit for Schools. Your school is now enrolled, and you can start onboarding students right away. The program is fully pre-recorded end-to-end, and your access is active for 12 months."

export function SchoolWelcomeNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const now = Date.now()
    const params = new URLSearchParams(window.location.search)
    if (params.get("welcome") === "school_enrolled") {
      window.localStorage.setItem(STORAGE_KEY, String(now))
      params.delete("welcome")
      const nextQuery = params.toString()
      window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`)
      setVisible(true)
      return
    }

    const stored = Number(window.localStorage.getItem(STORAGE_KEY) || 0)
    setVisible(stored > 0 && now - stored <= NOTICE_TTL_MS)
  }, [])

  if (!visible) return null

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/10 p-4 text-sm font-semibold leading-6 text-primary">
      {MESSAGE}
    </div>
  )
}

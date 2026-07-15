"use client"

import { useEffect } from "react"

const STORAGE_KEY = "tochukwu.videoLibrary.scrollY"

export function VideoLibraryScrollRestorer() {
  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const scrollY = raw ? Number(raw) : NaN
    if (Number.isFinite(scrollY) && scrollY >= 0) {
      sessionStorage.removeItem(STORAGE_KEY)
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: "auto" })
      })
    }

    const handleSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null
      if (!form?.closest("[data-video-library-page]")) return
      sessionStorage.setItem(STORAGE_KEY, String(window.scrollY))
    }

    document.addEventListener("submit", handleSubmit, true)
    return () => document.removeEventListener("submit", handleSubmit, true)
  }, [])

  return null
}

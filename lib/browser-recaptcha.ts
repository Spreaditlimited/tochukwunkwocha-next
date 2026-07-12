"use client"

let siteKeyPromise: Promise<string> | null = null
let scriptPromise: Promise<void> | null = null

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

async function getSiteKey() {
  if (!siteKeyPromise) {
    siteKeyPromise = fetch("/api/captcha/config", { headers: { Accept: "application/json" } })
      .then((response) => response.json())
      .then((json) => String(json?.siteKey || ""))
      .catch(() => "")
  }
  return siteKeyPromise
}

function loadScript(siteKey: string) {
  if (!siteKey) return Promise.resolve()
  if (window.grecaptcha) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>("script[data-recaptcha-v3]")
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true })
        existing.addEventListener("error", () => reject(new Error("Could not load reCAPTCHA.")), { once: true })
        return
      }
      const script = document.createElement("script")
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`
      script.async = true
      script.defer = true
      script.dataset.recaptchaV3 = "true"
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("Could not load reCAPTCHA."))
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

export async function getRecaptchaToken(action: string) {
  if (typeof window === "undefined") return ""
  const siteKey = await getSiteKey()
  if (!siteKey) return ""
  await loadScript(siteKey)
  if (!window.grecaptcha) return ""
  return new Promise<string>((resolve, reject) => {
    window.grecaptcha?.ready(() => {
      window.grecaptcha
        ?.execute(siteKey, { action })
        .then(resolve)
        .catch(() => reject(new Error("Could not verify this submission. Please try again.")))
    })
  })
}

"use client"

import { useEffect } from "react"

function isRawBrowserEvent(value: unknown) {
  return typeof Event !== "undefined" && value instanceof Event
}

export function RuntimeEventGuard() {
  useEffect(() => {
    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      if (isRawBrowserEvent(event.reason)) {
        event.preventDefault()
      }
    }

    function handleError(event: ErrorEvent) {
      if (isRawBrowserEvent(event.error) || event.message === "[object Event]") {
        event.preventDefault()
      }
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection)
    window.addEventListener("error", handleError)

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
      window.removeEventListener("error", handleError)
    }
  }, [])

  return null
}

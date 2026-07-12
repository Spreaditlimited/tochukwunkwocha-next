"use client"

import { Printer } from "lucide-react"

export function PrintCertificateButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary no-print">
      <Printer className="mr-2 h-4 w-4" />
      Print / Save PDF
    </button>
  )
}

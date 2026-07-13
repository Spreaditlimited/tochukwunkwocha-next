"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, ShieldCheck } from "lucide-react"

export function CertificateLookupForm() {
  const router = useRouter()
  const [certificateNo, setCertificateNo] = useState("")
  const [error, setError] = useState("")

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = certificateNo.trim().toUpperCase()
    if (!normalized) {
      setError("Enter a certificate number to continue.")
      return
    }
    setError("")
    router.push(`/certificates/verify/${encodeURIComponent(normalized)}`)
  }

  return (
    <form onSubmit={submit} className="mt-8 rounded-lg bg-card p-5 shadow-xl ring-1 ring-border sm:p-6">
      <label htmlFor="certificateNo" className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">
        Certificate Number
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <ShieldCheck className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            id="certificateNo"
            value={certificateNo}
            onChange={(event) => setCertificateNo(event.target.value)}
            placeholder="TN-IND-XXXXXXXXXXXXXX"
            className="h-14 w-full rounded-md border border-border bg-background pl-12 pr-4 font-mono text-sm font-bold uppercase text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            autoComplete="off"
          />
        </div>
        <button type="submit" className="btn-primary h-14 justify-center px-6">
          <Search className="mr-2 h-4 w-4" />
          Verify
        </button>
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-300">{error}</p> : null}
    </form>
  )
}

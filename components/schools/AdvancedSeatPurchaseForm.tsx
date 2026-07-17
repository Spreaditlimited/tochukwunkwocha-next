"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"

import { createSchoolAdvancedSeatCheckoutAction } from "@/app/schools/dashboard/actions"
import { AFFILIATE_REF_STORAGE_KEY } from "@/components/AffiliateReferralCapture"

export function AdvancedSeatPurchaseForm({ minSeats = 5 }: { minSeats?: number }) {
  const [seatCount, setSeatCount] = useState(minSeats)
  const [affiliateCode, setAffiliateCode] = useState("")

  useEffect(() => {
    try {
      setAffiliateCode(String(window.localStorage.getItem(AFFILIATE_REF_STORAGE_KEY) || "").trim().toUpperCase().slice(0, 40))
    } catch {
      setAffiliateCode("")
    }
  }, [])
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-6 rounded-lg border border-border bg-muted/20 p-4">
      <div className="grid gap-4 sm:grid-cols-[220px_1fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">Seats to buy</span>
          <input
            type="number"
            min={minSeats}
            value={seatCount}
            onChange={(event) => setSeatCount(Math.max(minSeats, Number(event.target.value) || minSeats))}
            className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </label>
        <p className="text-sm leading-6 text-muted-foreground">
          Purchase discounted Prompt to Profit Advanced seats for eligible school learners, then upgrade selected students below.
        </p>
        <button className="btn-primary justify-center" type="button" onClick={() => setOpen(true)}>Buy Advanced Seats</button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Advanced Seat Checkout</p>
                <h3 className="mt-2 font-heading text-2xl font-black text-foreground">Confirm seat purchase</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Seats</p>
              <p className="mt-2 font-heading text-4xl font-black text-foreground">{seatCount}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Pricing is confirmed securely before payment. Once payment is complete, these seats become available in this school dashboard.
              </p>
            </div>

            <form action={createSchoolAdvancedSeatCheckoutAction} className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <input type="hidden" name="seatCount" value={seatCount} />
              <input type="hidden" name="affiliateCode" value={affiliateCode} />
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary justify-center">Cancel</button>
              <button type="submit" className="btn-primary justify-center">Continue to Payment</button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

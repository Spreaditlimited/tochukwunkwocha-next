"use client"

import { useEffect, useState } from "react"

import { createSchoolAdvancedSeatCheckoutAction } from "@/app/schools/dashboard/actions"
import { AFFILIATE_REF_STORAGE_KEY } from "@/components/AffiliateReferralCapture"
import { DashboardModal } from "@/components/dashboard/DashboardModal"
import { SeatCountStepper } from "@/components/SeatCountStepper"

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
      <div className="grid min-w-0 gap-4 sm:grid-cols-[220px_minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0 max-w-full">
          <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">Seats to buy</span>
          <SeatCountStepper
            min={minSeats}
            max={500}
            value={seatCount}
            onChange={setSeatCount}
            className="mt-0 bg-background"
          />
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Purchase discounted Prompt to Profit Advanced seats for eligible school learners, then upgrade selected students below.
        </p>
        <button className="btn-primary justify-center" type="button" onClick={() => setOpen(true)}>Buy Advanced Seats</button>
      </div>

      {open ? (
        <DashboardModal
          title="Confirm seat purchase"
          eyebrow="Advanced Seat Checkout"
          onClose={() => setOpen(false)}
          closeLabel="Close advanced seat checkout"
          footer={
            <form action={createSchoolAdvancedSeatCheckoutAction} className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <input type="hidden" name="seatCount" value={seatCount} />
              <input type="hidden" name="affiliateCode" value={affiliateCode} />
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary justify-center">Cancel</button>
              <button type="submit" className="btn-primary justify-center">Continue to Payment</button>
            </form>
          }
        >
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Seats</p>
            <p className="mt-2 font-heading text-4xl font-black text-foreground">{seatCount}</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Pricing is confirmed securely before payment. Once payment is complete, these seats become available in this school dashboard.
            </p>
          </div>
        </DashboardModal>
      ) : null}
    </div>
  )
}

import Link from "next/link"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import type { CheckoutBatch } from "@/lib/payments/course-checkout"
import { formatDateTimeWAT } from "@/lib/utils"

type InstantAccessOfferProps = {
  batch: CheckoutBatch
  liveBatch?: CheckoutBatch | null
  checkoutHref: string
  centered?: boolean
}

export function InstantAccessOffer({ batch, liveBatch, checkoutHref, centered = false }: InstantAccessOfferProps) {
  return (
    <div className={`mt-8 ${centered ? "text-center" : "text-center lg:text-left"}`}>
      <p className={`flex items-center justify-center gap-2 text-sm font-semibold text-emerald-300 ${centered ? "" : "lg:justify-start"}`}>
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> Instant access · One year
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">
        Start all recorded lessons immediately after payment confirmation.
      </p>
      <div className={`mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-4 ${centered ? "" : "lg:justify-start"}`}>
        <Link href={`${checkoutHref}?batch=${encodeURIComponent(batch.batchKey)}`} className="btn-primary px-6 py-3 text-base">
          Enroll now <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Link>
        {liveBatch ? (
          <Link href={`${checkoutHref}?batch=${encodeURIComponent(liveBatch.batchKey)}`} className="py-2 text-sm font-semibold text-sky-200 underline underline-offset-4 hover:text-white">
            Join a live cohort
          </Link>
        ) : null}
      </div>
    </div>
  )
}

export function InstantAccessDetails({ batch, liveBatch }: Pick<InstantAccessOfferProps, "batch" | "liveBatch">) {
  const liveStart = formatDateTimeWAT(liveBatch?.batchStartAt)
  return (
    <section aria-labelledby="instant-access-details" className="border-b border-border bg-muted/20 py-8 sm:py-10">
      <div className="site-container grid gap-4 lg:grid-cols-[1fr_2fr] lg:gap-12">
        <div>
          <h2 id="instant-access-details" className="font-heading text-xl font-bold">How instant access works</h2>
          <p className="mt-2 text-sm text-muted-foreground">{batch.batchLabel}</p>
        </div>
        <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            All lessons and available class recordings from the completed cohort are ready to watch for one full year.
            Learn at your own pace, with no daily lesson emails or automated learning reminders.
          </p>
          <p>
            Access opens after payment confirmation. Bank transfers require approval, and installment plans must be fully paid.
            Live sessions are included with scheduled cohorts.
          </p>
          {liveBatch ? <p><strong className="font-semibold text-foreground">Next live cohort:</strong> {liveBatch.batchLabel}{liveStart ? ` · ${liveStart}` : ""}.</p> : null}
        </div>
      </div>
    </section>
  )
}

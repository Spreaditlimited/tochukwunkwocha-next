import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { brand } from "@/lib/brand"
import { buildMetadata } from "@/lib/site-seo"
import { SubscribePlans } from "./SubscribePlans"

export const metadata: Metadata = buildMetadata({
  title: "Subscribe | Private AI Build Coaching",
  description: "Choose your private coaching plan and start building.",
  path: "/private-ai-build-coaching/subscribe",
  noIndex: true
})

export default function PrivateCoachingSubscribePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-brand-ink text-white">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="pointer-events-none fixed -left-32 -top-32 h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-[130px]" />
      <div className="pointer-events-none fixed -bottom-32 -right-32 h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-[130px]" />

      <div className="site-container relative z-10 py-8">
        <Link href="/private-ai-build-coaching" className="inline-flex items-center text-sm font-bold text-emerald-400 no-underline transition-colors hover:text-emerald-300">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Coaching Details
        </Link>

        <div className="mt-10">
          <Image src={brand.assets.logoReverse} alt={brand.name} width={220} height={70} className="mb-10 h-auto w-48" priority />
          <p className="eyebrow text-emerald-400">Coaching Setup</p>
          <h1 className="mt-3 font-heading text-4xl font-black tracking-tight sm:text-5xl">Choose your coaching plan.</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
            Use this page after your discovery call to start the plan agreed upon for your private coaching sessions.
          </p>
        </div>

        <div className="mt-10">
          <SubscribePlans />
        </div>
      </div>
    </main>
  )
}

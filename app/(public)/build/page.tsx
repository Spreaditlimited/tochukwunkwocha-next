import Image from "next/image"
import Link from "next/link"
import { 
  ArrowRight, 
  CheckCircle2, 
  ClipboardCheck, 
  Code2,
  Map,
  Rocket, 
  Search, 
  ShieldCheck, 
  XCircle 
} from "lucide-react"

import { buildMetadata } from "@/lib/site-seo"

export const metadata = buildMetadata({
  title: "Build Service",
  description: "Founder-led custom web application builds for businesses that need practical dashboards, portals, workflows, and operational tools.",
  path: "/build"
})

const sectionContainer = "site-container"

export default function BuildPage() {
  const preferredProjects = [
    "Internal Dashboards", "Customer Portals", "School Systems", 
    "Booking Engines", "Workflow Automation", "Admin Systems"
  ]

  const declinedProjects = [
    "Ride Hailing Apps", "Consumer Social Networks", 
    "Complex Multi-vendor Marketplaces", "Large Fintech Platforms"
  ]

  return (
    <main>
      {/* 1. Immersive Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-brand-ink pt-16 text-white lg:pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        <div className="absolute right-0 top-0 -translate-y-1/4 translate-x-1/4 h-[500px] w-[500px] rounded-full bg-sky-500/20 blur-[150px] pointer-events-none"></div>

        <div className={`${sectionContainer} relative z-10 pb-20 lg:pb-28`}>
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 items-center">
            
            {/* Hero Content */}
            <div>
              <p className="eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1.5 text-sky-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500"></span>
                </span>
                Founder-Led Implementation
              </p>
              
              <h1 className="font-heading text-5xl font-black tracking-tighter sm:text-6xl lg:text-[4rem] lg:leading-[1.1]">
                I Personally Take <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-primary">One Build Project</span> Per Month.
              </h1>
              
              <p className="mt-6 text-lg leading-relaxed text-slate-300">
                I help businesses replace spreadsheets, manual processes, WhatsApp confusion, and operational bottlenecks with custom web applications—built and deployed within <strong className="text-white">30 days</strong>.
              </p>
              
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link className="btn-inverse px-8 py-4 text-base shadow-lg shadow-primary/20" href="/build-scorecard">
                  Apply for Build
                </Link>
                <Link className="btn-inverse-secondary px-8 py-4 text-base" href="#how-build-works">
                  See the Methodology
                </Link>
              </div>

              {/* Social Proof Trust Strip */}
              <div className="mt-12 border-t border-white/10 pt-8">
                <p className="mb-4 font-mono text-xs font-bold uppercase tracking-widest text-slate-500">Systems trusted by real businesses</p>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex h-12 items-center justify-center rounded-md border border-white/10 bg-white/5 px-4 text-sm font-bold text-slate-300">
                    Sure Imports
                  </div>
                  <div className="flex h-12 items-center justify-center rounded-md border border-white/10 bg-white/5 px-4 text-sm font-bold text-slate-300">
                    LineScout
                  </div>
                  <div className="flex h-12 items-center justify-center rounded-md border border-white/10 bg-white/5 px-4 text-sm font-bold text-slate-300">
                    Prompt to Profit
                  </div>
                </div>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative hidden lg:block">
              <div className="absolute -inset-4 rounded-2xl bg-sky-500/10 -z-10 transform rotate-2"></div>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a1120] shadow-2xl">
                <Image
                  src="/brand/tochukwu-portrait.webp"
                  alt="Tochukwu Nkwocha"
                  width={720}
                  height={900}
                  className="aspect-[4/5] w-full object-cover"
                  priority
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. How Build Works (5-Step Framework) */}
      <section id="how-build-works" className="border-b border-border bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mb-16 max-w-3xl">
            <p className="eyebrow">The 30-Day Pipeline</p>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
              How Build Works
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              A strict, five-step framework to go from chaos to deployment in 4 weeks.
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-5">
            
            {/* Step 1 */}
            <div className="surface-raised relative overflow-hidden bg-card p-6 lg:p-8">
              <span className="absolute -right-4 -top-6 font-heading text-[8rem] font-black leading-none text-muted/40 select-none">1</span>
              <div className="relative z-10">
                <ClipboardCheck className="mb-6 h-8 w-8 text-primary" />
                <h3 className="font-heading text-xl font-bold">Apply</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Complete the rigorous project scorecard to ensure a technical fit for the 30-day timeline.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="surface-raised relative overflow-hidden bg-card p-6 lg:p-8">
              <span className="absolute -right-4 -top-6 font-heading text-[8rem] font-black leading-none text-muted/40 select-none">2</span>
              <div className="relative z-10">
                <Search className="mb-6 h-8 w-8 text-sky-500" />
                <h3 className="font-heading text-xl font-bold">Discovery</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  A paid, high-level architectural strategy session to map out all core requirements.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="surface-raised relative overflow-hidden bg-card p-6 lg:p-8">
              <span className="absolute -right-4 -top-6 font-heading text-[8rem] font-black leading-none text-muted/40 select-none">3</span>
              <div className="relative z-10">
                <Map className="mb-6 h-8 w-8 text-primary" />
                <h3 className="font-heading text-xl font-bold">Plan</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Receive a zero ambiguity implementation roadmap detailing exactly what will be built.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="surface-raised relative overflow-hidden bg-brand-ink text-white p-6 lg:p-8">
              <span className="absolute -right-4 -top-6 font-heading text-[8rem] font-black leading-none text-white/5 select-none">4</span>
              <div className="relative z-10">
                <Code2 className="mb-6 h-8 w-8 text-sky-400" />
                <h3 className="font-heading text-xl font-bold text-white">Build</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  Heads-down, founder-led coding. App architecture designed and built in 30 days.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="surface-raised relative overflow-hidden bg-card p-6 lg:p-8">
              <span className="absolute -right-4 -top-6 font-heading text-[8rem] font-black leading-none text-muted/40 select-none">5</span>
              <div className="relative z-10">
                <Rocket className="mb-6 h-8 w-8 text-primary" />
                <h3 className="font-heading text-xl font-bold">Deploy</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Live deployment, team training, and complete handover of the functioning system.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. The Fit: Prefer vs Decline */}
      <section className="border-b border-border py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            
            {/* Preferred Projects */}
            <div>
              <div className="mb-8 flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h2 className="font-heading text-3xl font-black tracking-tight">Projects I Prefer</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {preferredProjects.map((project, i) => (
                  <div key={i} className="surface-raised bg-card p-5 transition-colors hover:border-emerald-500/30">
                    <p className="text-sm font-bold text-foreground">{project}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Declined Projects */}
            <div className="surface-raised relative overflow-hidden bg-rose-50/50 p-8 dark:bg-rose-950/10 sm:p-10 border-rose-200 dark:border-rose-900/30">
              <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-rose-500/5 blur-[80px] pointer-events-none -z-10"></div>
              
              <div className="mb-8 flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <XCircle className="h-6 w-6" />
                </div>
                <h2 className="font-heading text-3xl font-black tracking-tight">Projects I Decline</h2>
              </div>
              <p className="mb-8 text-base text-muted-foreground">
                To maintain a strict 30-day delivery standard, I automatically decline projects outside my core architectural focus.
              </p>
              
              <div className="grid gap-3">
                {declinedProjects.map((project, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-rose-200 bg-white p-4 text-sm font-medium text-foreground dark:border-rose-900/30 dark:bg-background">
                    <div className="h-2 w-2 shrink-0 rounded-full bg-rose-500"></div> 
                    {project}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. The Manifesto (Why Only One?) */}
      <section className="bg-muted/20 py-20 lg:py-28 border-b border-border">
        <div className={sectionContainer}>
          <div className="mx-auto max-w-5xl">
            <div className="surface-raised relative overflow-hidden bg-brand-ink px-8 py-16 text-center text-white sm:px-16 sm:py-24">
              {/* Abstract decorative blobs */}
              <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-primary/20 blur-[120px] pointer-events-none"></div>
              <div className="absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-sky-500/10 blur-[120px] pointer-events-none"></div>
              
              <div className="relative z-10 mx-auto max-w-3xl">
                <ShieldCheck className="mx-auto mb-6 h-12 w-12 text-sky-400" />
                <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  Why Only One Project Monthly?
                </h2>
                <div className="mt-10 space-y-6 text-lg leading-relaxed text-slate-300">
                  <p>
                    Each build is strictly <strong className="text-white">founder-led</strong>. I am directly involved in the strategy, architecture, and line-by-line execution rather than delegating your core implementation to a team of juniors.
                  </p>
                  <p>
                    Focusing on one project monthly gives your business undivided attention, faster architectural decisions, and zero context-switching across discovery, planning, and delivery.
                  </p>
                  <p>
                    This model intensely protects quality. You receive a cleaner product, a highly practical handover, and a resilient system your team can actually use from day one.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Final CTA */}
      <section className="py-24 text-center">
        <div className="site-container">
          <h2 className="font-heading text-4xl font-black tracking-tight sm:text-5xl">
            Applications are strictly limited.
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            Complete the Build scorecard to secure your 30-day implementation slot.
          </p>
          <div className="mt-10">
            <Link className="btn-primary px-10 py-5 text-lg shadow-lg shadow-primary/20" href="/build-scorecard">
              Start Your Application <ArrowRight className="ml-2 h-6 w-6" />
            </Link>
          </div>
        </div>
      </section>
      
    </main>
  )
}

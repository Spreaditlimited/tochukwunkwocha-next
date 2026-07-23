import Link from "next/link"
import { 
  ArrowRight, 
  Briefcase, 
  CheckCircle2, 
  Laptop, 
  Lightbulb, 
  LineChart, 
  Paintbrush, 
  PlayCircle, 
  ShoppingCart, 
  Users, 
  XCircle 
} from "lucide-react"

import { buildMetadata } from "@/lib/site-seo"

export const metadata = buildMetadata({
  title: "AI for Everyday Business Owners",
  description: "How to use ChatGPT to save time, write better, think clearly, and work faster. No coding. No fluff. Just useful work.",
  path: "/courses/ai-for-everyday-business-owners"
})

const sectionContainer = "site-container"

export default function EverydayBusinessOwnersPage() {
  const modules = [
    {
      num: "01",
      title: "How to Talk to AI So It Actually Helps You",
      desc: "Stop asking vague questions. Learn a simple, repeatable prompt structure that significantly improves AI output immediately."
    },
    {
      num: "02",
      title: "Using AI to Write Faster in Your Business",
      desc: "Turn rough thoughts into usable drafts. Perfect for product descriptions, emails, captions, and WhatsApp broadcasts."
    },
    {
      num: "03",
      title: "Using AI to Think More Clearly",
      desc: "AI isn't just for writing; it's for thinking. Learn to organize loose notes, break down big tasks, and compare options when you feel scattered."
    },
    {
      num: "04",
      title: "Using AI for Customer Communication",
      desc: "Build standard templates for repetitive situations: payment reminders, delayed deliveries, and handling price objections without losing your warmth."
    },
    {
      num: "05",
      title: "Content & Marketing Support",
      desc: "Content feels heavy. Learn how to stretch one raw idea into Facebook posts, Instagram captions, and video hooks while protecting your unique voice."
    },
    {
      num: "06",
      title: "Planning and Daily Productivity",
      desc: "Prepare for supplier calls, build basic daily checklists, and create simple weekly action plans to reduce operational friction."
    }
  ]

  const audiences = [
    { label: "Business Owners", icon: Briefcase },
    { label: "Freelancers", icon: Laptop },
    { label: "Service Providers", icon: Users },
    { label: "Online Sellers", icon: ShoppingCart },
    { label: "Creators", icon: Paintbrush },
    { label: "Professionals", icon: LineChart }
  ]

  return (
    <main className="bg-background">
      
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-brand-ink pt-16 text-white lg:pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sky/15 blur-[150px]" />
        
        <div className={`${sectionContainer} relative z-10 pb-20 lg:pb-28`}>
          <div className="mx-auto max-w-4xl text-center">
            
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-sky-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500"></span>
              </span>
              Practical AI for the Real World
            </div>
            
            <h1 className="font-heading text-5xl font-black leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
              AI for Everyday <br className="hidden md:block" />
              <span className="bg-gradient-to-r from-sky-400 to-primary bg-clip-text text-transparent">Business Owners</span>
            </h1>
            
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
              How to use ChatGPT to save time, write better, think clearly, and work faster. <strong className="font-semibold text-white">No coding. No fluff. Just useful work.</strong>
            </p>
            
            <div className="mx-auto mt-10 flex max-w-xl flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/checkout/ai-for-everyday-business-owners" className="btn-primary w-full justify-center px-8 py-4 text-base shadow-lg shadow-primary/20 sm:w-auto">
                <PlayCircle className="mr-2 h-5 w-5" /> Start the Course
              </Link>
              <a href="#curriculum" className="btn-secondary w-full justify-center px-8 py-4 text-base sm:w-auto">
                See What You'll Learn
              </a>
            </div>
            
          </div>
        </div>
      </section>

      {/* 2. The Problem & Reality Check */}
      <section className="bg-muted/20 py-20 lg:py-28 border-b border-border/50">
        <div className={sectionContainer}>
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            
            <div className="max-w-xl">
              <h2 className="font-heading text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
                The problem isn't that AI is useless.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                The problem is that people do not know how to use it well. They ask weak questions. They give no context. They expect too much too quickly.
              </p>
              
              <div className="mt-8 rounded-2xl border-l-4 border-primary bg-card p-6 shadow-sm sm:p-8">
                <p className="text-lg font-medium italic leading-relaxed text-foreground">
                  "Think of ChatGPT as a capable assistant. Not a prophet. Not a magician. The quality of your direction directly affects the quality of the output."
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="surface-raised group flex gap-6 bg-card p-6 transition-colors hover:border-primary/30 sm:p-8">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <XCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-heading text-xl font-bold text-foreground">What ChatGPT is NOT</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    A magic wand that automatically knows your business. Discover the widespread misconceptions that lead to robotic, frustrating results, and why most people get it completely wrong.
                  </p>
                </div>
              </div>
              
              <div className="surface-raised group flex gap-6 bg-card p-6 transition-colors hover:border-emerald-500/30 sm:p-8">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-heading text-xl font-bold text-foreground">What ChatGPT IS Good At</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Acting as a high-speed assistant for your heavy lifting. Find out which everyday tasks you should be handing off right now to clear your mind and instantly multiply your output.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. Target Audience */}
      <section className="py-20 lg:py-28 border-b border-border/50">
        <div className={sectionContainer}>
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow inline-flex items-center gap-2 text-primary">
              <Users className="h-4 w-4" /> Target Audience
            </p>
            <h2 className="mt-4 font-heading text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              Who is this course for?
            </h2>
          </div>
          
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:gap-6">
            {audiences.map((item, i) => {
              const Icon = item.icon
              return (
                <div key={i} className="surface-raised flex flex-col items-center justify-center gap-4 bg-card p-8 text-center transition-transform hover:-translate-y-1 hover:border-primary/30 hover:shadow-md">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="font-heading text-lg font-bold text-foreground">{item.label}</span>
                </div>
              )
            })}
          </div>
          
          <div className="mx-auto mt-16 max-w-2xl text-center">
            <p className="text-lg leading-relaxed text-muted-foreground sm:text-xl">
              If you do serious work and want practical help from AI to get more done with less friction, <strong className="font-semibold text-foreground">you are in the right place.</strong>
            </p>
          </div>
        </div>
      </section>

      {/* 4. Curriculum */}
      <section id="curriculum" className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mb-16 text-center lg:mb-20">
            <p className="eyebrow text-primary">Inside the Course</p>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              7 practical modules designed for immediate application.
            </h2>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod) => (
              <div key={mod.num} className="surface-raised flex flex-col bg-card p-8 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-md">
                <span className="mb-5 inline-flex w-fit items-center rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Module {mod.num}
                </span>
                <h3 className="font-heading text-xl font-bold leading-snug text-foreground">
                  {mod.title}
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {mod.desc}
                </p>
              </div>
            ))}
          </div>
          
          {/* Module 7 Highlight */}
          <div className="mx-auto mt-8 max-w-3xl">
            <div className="relative overflow-hidden rounded-3xl bg-brand-ink p-8 text-white shadow-2xl sm:p-12">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/25 blur-[80px]" />
              
              <div className="relative z-10">
                <span className="mb-5 inline-flex items-center rounded-lg border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-300">
                  Module 07
                </span>
                <h3 className="font-heading text-2xl font-black leading-tight sm:text-3xl">
                  Mistakes to Avoid When Using AI
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">
                  Don't let convenience make you careless. Discover the common traps that make businesses look unprofessional and learn the essential guardrails to protect your brand's voice and reputation.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 5. Final Enrollment CTA */}
      <section className="relative overflow-hidden bg-brand-ink py-24 text-center text-white sm:py-32">
        <div className="absolute inset-0 opacity-10 mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        
        <div className="site-container relative z-10 mx-auto max-w-3xl px-5 sm:px-6 lg:px-8">
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-sm">
            <Lightbulb className="h-8 w-8 text-sky-400" />
          </div>
          
          <h2 className="font-heading text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Ready to work smarter?
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-slate-300 sm:text-xl">
            AI is not here to replace serious business people. It is here to help serious business people work better. Learn how to use it properly today.
          </p>
          
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/checkout/ai-for-everyday-business-owners" className="btn-primary flex w-full items-center justify-center bg-white text-brand-ink hover:bg-slate-100 sm:w-auto px-8 py-4 text-base">
              Enroll in the Course <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Instant Access • Start Learning Immediately
          </p>
        </div>
      </section>

    </main>
  )
}

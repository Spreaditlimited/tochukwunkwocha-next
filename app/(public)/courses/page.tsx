import Link from "next/link"
import { 
  ArrowRight, 
  Award, 
  BookOpen, 
  Briefcase, 
  CheckCircle2, 
  Code2, 
  CreditCard, 
  HelpCircle, 
  Layout, 
  LayoutDashboard, 
  School, 
  ShieldCheck, 
  Sparkles,
  Terminal 
} from "lucide-react"

import { PromptToProfitMark, TrademarkText } from "@/components/TrademarkText"
import { brand } from "@/lib/brand"
import { buildMetadata } from "@/lib/site-seo"

export const metadata = buildMetadata({
  title: "AI Courses and Programmes",
  description: "Explore practical AI programmes for beginners, advanced builders, schools, and business owners.",
  path: "/courses"
})

const sectionContainer = "site-container"

export default function ProgrammesPage() {
  const builtProjects = [
    "Business websites", "Personal portfolio websites", "Inventory management systems",
    "Expense trackers", "Invoice generators", "School management tools",
    "AI-powered productivity workflows", "Interactive calculators", "Landing pages",
    "Business automation tools", "Custom software for everyday tasks"
  ]

  return (
    <main>
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-brand-ink pt-16 text-white lg:pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sky/15 blur-[150px]"></div>
        
        <div className={`${sectionContainer} relative z-10 pb-16 lg:pb-24`}>
          <div className="mx-auto max-w-4xl text-center">
            <p className="eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-brand-sky/30 bg-brand-sky/10 px-4 py-1.5 text-brand-sky">
              <BookOpen className="h-4 w-4" />
              Academy Curriculum
            </p>
            <h1 className="font-heading text-5xl font-black tracking-tighter text-white sm:text-6xl lg:text-7xl lg:leading-[1.1]">
              Learn Practical AI by <span className="bg-gradient-to-r from-brand-sky to-primary bg-clip-text text-transparent">Building Real Projects.</span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-300">
              Every programme at {brand.name} is designed around one simple belief: people learn AI best when they build. From complete beginners to experienced professionals, follow a structured path that combines clear instruction with practical execution.
            </p>
          </div>
        </div>
      </section>

      {/* 2. The Core Programmes Grid */}
      <section className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mb-16 max-w-3xl">
            <p className="eyebrow">Find the Right Programme</p>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
              Every learner has different goals.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Explore our programmes below to find the one that best matches where you are today and where you want to go next.
            </p>
          </div>
          
          <div className="grid gap-12 lg:gap-16">
            
            {/* Prompt to Profit Basic */}
            <div className="surface-raised grid overflow-hidden bg-card lg:grid-cols-[1.2fr_0.8fr]">
              <div className="p-8 sm:p-12">
                <div className="mb-6 inline-flex rounded-lg bg-primary/10 p-4 text-primary">
                  <Code2 className="h-8 w-8" />
                </div>
                <h3 className="font-heading text-3xl font-black tracking-tight lg:text-4xl"><PromptToProfitMark suffix=" Basic" /></h3>
                <p className="mt-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">Build Your First Digital Projects</p>
                <div className="mt-6 space-y-4 text-lg leading-relaxed text-muted-foreground">
                  <p>Our flagship programme for complete beginners. You do not need programming experience or a technical background.</p>
                  <p>We start from the fundamentals and gradually guide you through the process of working effectively with AI to build practical digital solutions. Learn how to think clearly, solve problems, and collaborate with AI in a structured way.</p>
                </div>
                <div className="mt-10 hidden lg:block">
                  <Link href="/courses/prompt-to-profit" className="btn-primary px-8 py-3.5 text-base">
                    Explore
                  </Link>
                </div>
              </div>
              <div className="border-t border-border bg-muted/30 p-8 sm:p-12 lg:border-l lg:border-t-0">
                <h4 className="font-heading text-lg font-bold">What You Will Learn</h4>
                <ul className="mt-6 space-y-4">
                  {["Working effectively with AI", "Writing better prompts", "Building websites", "Creating business tools", "Solving everyday problems", "Developing digital skills"].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm font-semibold text-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {item}
                    </li>
                  ))}
                </ul>
                <h4 className="mt-10 font-heading text-lg font-bold">Suitable For</h4>
                <div className="mt-6 flex flex-wrap gap-2">
                  {["Complete beginners", "Students", "Parents", "Professionals", "Entrepreneurs", "Career changers"].map((badge, i) => (
                    <span key={i} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">{badge}</span>
                  ))}
                </div>
                <div className="mt-10 lg:hidden">
                  <Link href="/courses/prompt-to-profit" className="btn-primary px-8 py-3.5 text-base">
                    Explore
                  </Link>
                </div>
              </div>
            </div>

            {/* Prompt to Profit Advanced */}
            <div className="surface-raised grid overflow-hidden bg-brand-ink text-white lg:grid-cols-[1.2fr_0.8fr]">
              <div className="p-8 sm:p-12">
                <div className="mb-6 inline-flex rounded-lg bg-white/10 p-4 text-sky-400">
                  <Terminal className="h-8 w-8" />
                </div>
                <h3 className="font-heading text-3xl font-black tracking-tight text-white lg:text-4xl"><PromptToProfitMark suffix=" Advanced" /></h3>
                <p className="mt-2 text-sm font-bold uppercase tracking-widest text-sky-400/80">Build More Powerful Applications</p>
                <div className="mt-6 space-y-4 text-lg leading-relaxed text-slate-300">
                  <p>Designed for learners who are ready to move beyond beginner projects.</p>
                  <p>The programme focuses on developing larger applications, working with databases, user authentication, structured project architecture, and AI-assisted software development for real business use cases.</p>
                </div>
                <div className="mt-10 hidden lg:block">
                  <Link href="/courses/prompt-to-production" className="btn-inverse px-8 py-3.5 text-base">
                    Explore
                  </Link>
                </div>
              </div>
              <div className="border-t border-white/10 bg-white/5 p-8 sm:p-12 lg:border-l lg:border-t-0">
                <h4 className="font-heading text-lg font-bold text-white">Outcome</h4>
                <p className="mt-4 text-sm leading-relaxed text-slate-400">
                  Develop larger, more capable software solutions while building confidence in designing and managing real-world applications.
                </p>
                <h4 className="mt-10 font-heading text-lg font-bold text-white">Suitable For</h4>
                <ul className="mt-6 space-y-4">
                  {["Graduates of Prompt to Profit Basic", "Developers seeking AI workflows", "Entrepreneurs", "Professionals", "Business owners"].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm font-semibold text-slate-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" /> <TrademarkText text={item} />
                    </li>
                  ))}
                </ul>
                <div className="mt-10 lg:hidden">
                  <Link href="/courses/prompt-to-production" className="btn-inverse px-8 py-3.5 text-base">
                    Explore
                  </Link>
                </div>
              </div>
            </div>

            {/* AI for Everyday Business Owners */}
            <div className="surface-raised grid overflow-hidden bg-card lg:grid-cols-[1.2fr_0.8fr]">
              <div className="p-8 sm:p-12">
                <div className="mb-6 inline-flex rounded-lg bg-primary/10 p-4 text-primary">
                  <Sparkles className="h-8 w-8" />
                </div>
                <h3 className="font-heading text-3xl font-black tracking-tight lg:text-4xl">
                  AI for Everyday Business Owners
                </h3>
                <p className="mt-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Practical AI for Daily Business Work
                </p>
                <div className="mt-6 space-y-4 text-lg leading-relaxed text-muted-foreground">
                  <p>A practical programme for business owners who want useful results from AI without learning to code.</p>
                  <p>Learn how to use ChatGPT to save time, improve customer communication, create stronger content, organise ideas, and work through everyday business tasks with greater clarity.</p>
                </div>
                <div className="mt-10 hidden lg:block">
                  <Link href="/courses/ai-for-everyday-business-owners" className="btn-primary px-8 py-3.5 text-base">
                    Explore
                  </Link>
                </div>
              </div>
              <div className="border-t border-border bg-muted/30 p-8 sm:p-12 lg:border-l lg:border-t-0">
                <h4 className="font-heading text-lg font-bold">What You Will Learn</h4>
                <ul className="mt-6 space-y-4">
                  {[
                    "Writing clear, useful AI prompts",
                    "Creating business content faster",
                    "Improving customer communication",
                    "Planning and organising daily work",
                    "Thinking through business decisions",
                    "Avoiding common AI mistakes"
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm font-semibold text-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {item}
                    </li>
                  ))}
                </ul>
                <h4 className="mt-10 font-heading text-lg font-bold">Suitable For</h4>
                <div className="mt-6 flex flex-wrap gap-2">
                  {["Business owners", "Freelancers", "Service providers", "Online sellers", "Creators", "Professionals"].map((badge) => (
                    <span key={badge} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">{badge}</span>
                  ))}
                </div>
                <div className="mt-10 lg:hidden">
                  <Link href="/courses/ai-for-everyday-business-owners" className="btn-primary px-8 py-3.5 text-base">
                    Explore
                  </Link>
                </div>
              </div>
            </div>

            {/* Schools Programme */}
            <div className="surface-raised grid overflow-hidden bg-brand-ink text-white lg:grid-cols-[1.2fr_0.8fr]">
              <div className="p-8 sm:p-12">
                <div className="mb-6 inline-flex rounded-lg bg-white/10 p-4 text-sky-400">
                  <School className="h-8 w-8" />
                </div>
                <h3 className="font-heading text-3xl font-black tracking-tight text-white lg:text-4xl">Schools Programme</h3>
                <p className="mt-2 text-sm font-bold uppercase tracking-widest text-sky-400/80">Practical AI Education for Schools</p>
                <div className="mt-6 space-y-4 text-lg leading-relaxed text-slate-300">
                  <p>Enable your educational institution to introduce structured AI learning without increasing administrative complexity.</p>
                  <p>Suitable for primary schools, secondary schools, after-school clubs, and other educational organisations that want to prepare learners for a future shaped by Artificial Intelligence.</p>
                </div>
                <div className="mt-10 hidden lg:block">
                  <Link href="/courses/prompt-to-profit-schools" className="btn-inverse px-8 py-3.5 text-base">
                    Explore
                  </Link>
                </div>
              </div>
              <div className="border-t border-white/10 bg-white/5 p-8 sm:p-12 lg:border-l lg:border-t-0">
                <h4 className="font-heading text-lg font-bold text-white">Programme Features</h4>
                <ul className="mt-6 space-y-4">
                  {[
                    { text: "Dedicated school dashboard", icon: LayoutDashboard },
                    { text: "Unique student access codes", icon: ShieldCheck },
                    { text: "No student email addresses required", icon: ShieldCheck },
                    { text: "Student progress monitoring", icon: Layout },
                    { text: "Privacy-conscious design", icon: ShieldCheck },
                    { text: "Project-based learning", icon: Briefcase },
                    { text: "Practical certificates", icon: Award }
                  ].map((item, i) => {
                    const Icon = item.icon
                    return (
                      <li key={i} className="flex items-center gap-3 text-sm font-semibold text-slate-300">
                        <Icon className="h-4 w-4 shrink-0 text-sky-400" /> {item.text}
                      </li>
                    )
                  })}
                </ul>
                <div className="mt-10 lg:hidden">
                  <Link href="/courses/prompt-to-profit-schools" className="btn-inverse px-8 py-3.5 text-base">
                    Explore
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. Learn by Building (Project Showcase) */}
      <section className="py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div>
              <p className="eyebrow">Methodology</p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
                Learn by Building.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                Our programmes are designed around practical application rather than passive learning. Every completed project builds confidence and strengthens your understanding of AI capabilities.
              </p>
            </div>
            <div className="surface-raised bg-muted/30 p-8">
              <p className="font-heading font-bold mb-6">Learners build projects including:</p>
              <div className="flex flex-wrap gap-3">
                {builtProjects.map((project, i) => (
                  <span key={i} className="inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm">
                    {project}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Certificates & Payments Split */}
      <section className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-8 lg:grid-cols-2">
            
            {/* Certificates */}
            <div className="surface-raised relative overflow-hidden bg-brand-ink p-8 text-white sm:p-12">
              <div className="absolute -right-10 -top-10 text-white/5 pointer-events-none">
                <Award className="h-64 w-64" />
              </div>
              <div className="relative z-10">
                <Award className="mb-6 h-10 w-10 text-sky-400" />
                <h3 className="font-heading text-2xl font-black tracking-tight lg:text-3xl">Certificates That Demonstrate Ability</h3>
                <div className="mt-6 space-y-4 text-slate-300 leading-relaxed">
                  <p>Watching videos alone does not earn a certificate at {brand.name}. Certificates are awarded only after learners successfully complete and submit practical projects.</p>
                  <p>Each certificate includes a verification link connected to a real project built by the learner, allowing employers, clients, and schools to verify practical achievement.</p>
                  <p className="font-bold text-white mt-6">We believe meaningful learning should produce meaningful evidence.</p>
                </div>
              </div>
            </div>

            {/* Payments */}
            <div className="surface-raised bg-card p-8 sm:p-12">
              <CreditCard className="mb-6 h-10 w-10 text-primary" />
              <h3 className="font-heading text-2xl font-black tracking-tight lg:text-3xl">Flexible Payment Options</h3>
              <p className="mt-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">Learn Now. Pay in Instalments.</p>
              <div className="mt-6 space-y-4 text-muted-foreground leading-relaxed">
                <p>We believe financial constraints should not prevent people from developing valuable digital skills.</p>
                <p>Our flexible instalment payment system allows eligible learners to spread the cost of selected programmes over time, making it easier to begin learning without waiting until the full amount is available.</p>
              </div>
              <div className="mt-10">
                <Link href="/payments" className="font-bold text-primary hover:underline">
                  Explore Payment Options
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Decision Guide */}
      <section className="py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mb-12 text-center max-w-3xl mx-auto">
            <HelpCircle className="mx-auto mb-6 h-10 w-10 text-muted-foreground/50" />
            <h2 className="font-heading text-3xl font-black tracking-tight">Which programme should you start with?</h2>
          </div>
          
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6 text-center">
              <p className="font-heading font-bold text-lg mb-3">Completely New to AI?</p>
              <p className="text-sm text-muted-foreground leading-relaxed">We recommend beginning with <strong className="text-foreground"><PromptToProfitMark suffix=" Basic" /></strong> to build your foundation.</p>
            </div>
            <div className="rounded-xl border border-border p-6 text-center bg-muted/20">
              <p className="font-heading font-bold text-lg mb-3">Ready for Complex Apps?</p>
              <p className="text-sm text-muted-foreground leading-relaxed">If you want to build larger, sophisticated applications, <strong className="text-foreground"><PromptToProfitMark suffix=" Advanced" /></strong> is the natural next step.</p>
            </div>
            <div className="rounded-xl border border-border p-6 text-center">
              <p className="font-heading font-bold text-lg mb-3">Representing a School?</p>
              <p className="text-sm text-muted-foreground leading-relaxed">Our <strong className="text-foreground">Schools Programme</strong> provides the administrative tools needed to deliver structured education safely.</p>
            </div>
          </div>
          
          <div className="mt-12 text-center">
            <p className="text-lg font-medium text-foreground">
              Wherever you begin, our goal remains the same: help you build practical skills that continue to serve you long after the course is complete.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Final CTA */}
      <section className="bg-brand-ink py-24 text-center text-white">
        <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8">
          <h2 className="font-heading text-4xl font-black tracking-tight sm:text-5xl">
            Ready to Start Learning?
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-slate-300">
            Whether you are learning for personal growth, career development, business improvement, or education, our programmes are designed to help you move from curiosity to capability.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link className="btn-inverse px-8 py-4 text-base" href="/courses/prompt-to-profit">
              Begin Building Today <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link className="btn-inverse-secondary px-8 py-4 text-base" href="/contact">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

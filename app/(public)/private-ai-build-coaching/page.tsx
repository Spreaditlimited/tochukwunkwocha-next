import Image from "next/image"
import Link from "next/link"
import { 
  ArrowRight, 
  CheckCircle2, 
  ChevronDown, 
  Code2, 
  Cpu, 
  Globe2,
  MessageSquare,
  Rocket, 
  ShieldCheck,
  XCircle 
} from "lucide-react"

import { buildMetadata } from "@/lib/site-seo"
import { CoachingPricingCards } from "./CoachingPricingCards"

export const metadata = buildMetadata({
  title: "Private AI Build Coaching",
  description: "Personal AI build coaching for learners who want direct guidance while building practical digital tools.",
  path: "/private-ai-build-coaching"
})

const sectionContainer = "site-container"

export default function PrivateCoachingPage() {
  const socialProofAvatars = [
    { src: "/testimonials/okoyeocha.png", alt: "Past student testimonial" },
    { src: "/testimonials/rosemary-blessing-alor.png", alt: "Past student testimonial" },
    { src: "/testimonials/adedayo-adewoye.png", alt: "Past student testimonial" }
  ]

  const faqs = [
    { q: "Do I need to know how to code?", a: "No. We focus entirely on \"no-code\" AI tools and prompting techniques. If you can type clear instructions and are willing to learn, you can build impressive digital tools." },
    { q: "Why is the Discovery Call paid?", a: "Because my time is strictly limited to 5 students per month, the paid call acts as a filter for serious applicants only. It ensures that even if we don't proceed with coaching, you still leave the call with a highly valuable, actionable roadmap for your idea." },
    { q: "Can you just build it for me?", a: "Yes, but you will have to use the Build service. This coaching program is for people who want to build with guidance and learn how to maintain, fix, and expand their own tool." }
  ]

  return (
    <main>
      {/* 1. Immersive Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-brand-ink pt-16 text-white lg:pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sky/15 blur-[150px]"></div>

        <div className={`${sectionContainer} relative z-10 pb-20 lg:pb-28`}>
          <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16 items-center">
            
            {/* Hero Content */}
            <div className="text-center lg:text-left">
              <p className="eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-brand-sky">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-sky opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                </span>
                Private AI Build Coaching
              </p>
              
              <h1 className="max-w-4xl font-heading text-5xl font-black leading-[1.03] tracking-tighter [text-wrap:balance] sm:text-6xl sm:leading-[1.05] lg:text-7xl lg:leading-[1.1]">
                Build your digital tool with <span className="bg-gradient-to-r from-brand-sky to-primary bg-clip-text text-transparent">personal guidance.</span>
              </h1>
              
              <p className="mt-6 max-w-3xl text-lg font-medium leading-relaxed text-slate-300 [text-wrap:pretty] sm:text-xl">
                One-on-one coaching for students who want private help turning an idea into a working digital tool using AI.
              </p>
              
              <div className="mx-auto mt-10 flex max-w-xl flex-col items-center justify-center gap-4 sm:flex-row lg:mx-0 lg:justify-start">
                <Link className="btn-primary w-full px-8 py-4 text-base shadow-lg shadow-primary/20 sm:w-auto" href="/private-ai-build-coaching/apply">
                  Apply Now
                </Link>
                <Link className="btn-secondary w-full px-8 py-4 text-base sm:w-auto" href="#pricing">
                  View Pricing
                </Link>
              </div>

              {/* Social Proof Strip */}
              <div className="mt-12 flex min-w-0 items-center justify-center gap-4 border-t border-white/10 pt-8 lg:justify-start">
                <div className="flex shrink-0 items-center">
                  {socialProofAvatars.map((avatar, index) => (
                    <Image
                      key={avatar.src}
                      src={avatar.src}
                      alt={avatar.alt}
                      width={40}
                      height={40}
                      className="relative h-10 w-10 rounded-full border-2 border-brand-ink bg-slate-800 object-cover shadow-lg"
                      style={{
                        marginLeft: index === 0 ? 0 : -12,
                        zIndex: socialProofAvatars.length - index
                      }}
                    />
                  ))}
                </div>
                <p className="text-sm font-mono text-slate-400">Strictly limited to <strong className="text-white">5 students</strong> per month.</p>
              </div>
            </div>

            {/* Hero Value Card */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/20 blur-xl opacity-60"></div>
              <div className="relative rounded-2xl border border-white/10 bg-brand-navy/80 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
                <div className="mb-8 flex items-center gap-4 border-b border-white/10 pb-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-brand-sky border border-primary/20">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <h3 className="font-heading text-lg font-bold text-white uppercase tracking-wider">The Problem We Solve</h3>
                </div>
                <div className="space-y-6 text-base leading-relaxed text-slate-300">
                  <p>Learning AI theory from videos is easy. <strong className="text-white">Building a working product by yourself is hard.</strong></p>
                  <p>You get stuck on technical setup, prompt failures, integrations, or simply deciding what to do next. You waste hours debugging issues that an expert could solve in minutes.</p>
                  <p>This coaching bridges the gap between <span className="text-brand-sky font-medium">"I have an idea"</span> and <span className="text-brand-sky font-medium">"My tool is live."</span></p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. What We Can Build (Possibilities) */}
      <section className="border-b border-border bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mb-16 text-center max-w-3xl mx-auto">
            <p className="eyebrow text-brand-sky">Possibilities</p>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              What can we build together?
            </h2>
            <p className="mt-6 text-lg text-muted-foreground">
              Bring your own project, or let us help you conceptualize one. We focus on practical, deployable solutions.
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-3">
            <div className="surface-raised bg-card p-8 transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
              <Globe2 className="mb-6 h-10 w-10 text-primary" />
              <h3 className="font-heading text-xl font-bold">AI-Powered Websites</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Landing pages, portfolios, or business sites with integrated AI features, built without writing complex code.</p>
            </div>
            <div className="surface-raised bg-card p-8 transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
              <MessageSquare className="mb-6 h-10 w-10 text-primary" />
              <h3 className="font-heading text-xl font-bold">Custom Chatbots</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Train an AI assistant on your specific business data or school curriculum to handle customer support or tutoring.</p>
            </div>
            <div className="surface-raised bg-card p-8 transition-all hover:-translate-y-1 hover:shadow-lg hover:border-brand-sky/30">
              <Cpu className="mb-6 h-10 w-10 text-brand-sky" />
              <h3 className="font-heading text-xl font-bold">Automated Workflows</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Connect multiple tools (like forms, emails, and ChatGPT) to automate hours of manual weekly tasks.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. The Process (Vertical Timeline) */}
      <section className="border-b border-border py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            
            <div className="lg:sticky lg:top-28 lg:h-fit">
              <p className="eyebrow text-primary">The Process</p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
                How private coaching works.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                A structured, no-nonsense approach to getting your project from zero to launched.
              </p>
            </div>

            <div className="relative space-y-8 before:absolute before:inset-0 before:ml-[34px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary/50 before:via-primary/10 before:to-transparent">
              
              <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                <div className="flex items-center justify-center w-16 h-16 rounded-full border-4 border-background bg-card shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 font-heading font-black text-xl text-foreground">
                  1
                </div>
                <div className="w-[calc(100%-5rem)] md:w-[calc(50%-3rem)] surface-raised bg-card p-6">
                  <h3 className="font-heading text-xl font-bold">Discovery Call</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">We hop on a paid consultation to discuss your idea, assess your current skill level, and determine if my coaching is the right fit.</p>
                </div>
              </div>

              <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                <div className="flex items-center justify-center w-16 h-16 rounded-full border-4 border-background bg-card shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 font-heading font-black text-xl text-foreground">
                  2
                </div>
                <div className="w-[calc(100%-5rem)] md:w-[calc(50%-3rem)] surface-raised bg-card p-6">
                  <h3 className="font-heading text-xl font-bold">Strategic Roadmap</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">If we proceed, we map out the exact architecture of your tool. We select the right AI models and establish a clear timeline.</p>
                </div>
              </div>

              <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                <div className="flex items-center justify-center w-16 h-16 rounded-full border-4 border-background bg-card shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 font-heading font-black text-xl text-foreground">
                  3
                </div>
                <div className="w-[calc(100%-5rem)] md:w-[calc(50%-3rem)] surface-raised bg-card p-6">
                  <h3 className="font-heading text-xl font-bold">Guided Build Sessions</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">We meet for dedicated 1-on-1 sessions. I watch you build, provide screen-share guidance, debug your prompts, and assign homework.</p>
                </div>
              </div>

              <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                <div className="flex items-center justify-center w-16 h-16 rounded-full border-4 border-primary/20 bg-primary/10 text-primary shadow-lg shadow-primary/20 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 font-heading font-black text-xl">
                  4
                </div>
                <div className="surface-raised w-[calc(100%-5rem)] border-primary/30 bg-primary/5 p-6 dark:bg-primary/10 md:w-[calc(50%-3rem)]">
                  <h3 className="font-heading text-xl font-bold">Launch & Iterate</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">We finalize the project, deploy it live to the web, and test it. You leave with a working digital asset and the skills to maintain it.</p>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* 4. Who this is for (Qualification Split) */}
      <section className="border-b border-border bg-brand-ink py-20 text-white lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-8 md:grid-cols-2">
            
            {/* Who it is FOR */}
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-8 sm:p-10">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-brand-sky">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="font-heading text-2xl font-bold">Who this is for</h3>
              </div>
              <ul className="space-y-4 text-sm leading-relaxed text-slate-300">
                <li className="flex gap-3"><span className="text-brand-sky">•</span> Students who want private attention instead of a group class.</li>
                <li className="flex gap-3"><span className="text-brand-sky">•</span> Founders who need an MVP but lack technical direction.</li>
                <li className="flex gap-3"><span className="text-brand-sky">•</span> Action-takers willing to do the homework between sessions.</li>
                <li className="flex gap-3"><span className="text-brand-sky">•</span> Beginners who want patient review and direct feedback.</li>
              </ul>
            </div>

            {/* Who it is NOT FOR */}
            <div className="rounded-2xl border border-destructive/20 bg-gradient-to-br from-destructive/10 to-transparent p-8 sm:p-10">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-destructive">
                  <XCircle className="h-6 w-6" />
                </div>
                <h3 className="font-heading text-2xl font-bold">Who this is NOT for</h3>
              </div>
              <ul className="space-y-4 text-sm leading-relaxed text-slate-300">
                <li className="flex gap-3"><span className="text-destructive">•</span> People looking for a "done-for-you" agency service. (I coach you; I don't build it for you).</li>
                <li className="flex gap-3"><span className="text-destructive">•</span> Those seeking get-rich-quick AI schemes.</li>
                <li className="flex gap-3"><span className="text-destructive">•</span> Students who won't commit time to practice outside of our calls.</li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Pricing Section (Client Component Injection) */}
      <section id="pricing" className="border-b border-border bg-background py-20 lg:py-32">
        <div className={sectionContainer}>
          <div className="mb-16 text-center max-w-3xl mx-auto">
            <p className="eyebrow text-primary">Investment</p>
            <h2 className="mt-3 font-heading text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Transparent pricing.<br/>No hidden retainers.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Start with a discovery call. If we're a fit, choose the monthly coaching plan that matches your pace. Every plan is based on the same hourly rate—you only pay for the time you need.
            </p>
          </div>

          {/* Render the Client Component for Pricing Logic */}
          <CoachingPricingCards />

          {/* Value Props below pricing */}
          <div className="mt-20 grid gap-8 border-t border-border pt-12 md:grid-cols-3">
            <div className="surface-raised bg-card p-6">
              <Code2 className="mb-4 h-8 w-8 text-primary" />
              <h4 className="font-heading text-lg font-bold">How Pricing Works</h4>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Monthly plan price equals the included coaching hours multiplied by the hourly rate, plus standard payment processing fees.</p>
            </div>
            <div className="surface-raised bg-card p-6">
              <Rocket className="mb-4 h-8 w-8 text-brand-sky" />
              <h4 className="font-heading text-lg font-bold">Included Resources</h4>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Every plan includes immediate access to the Advanced class lessons, VS Code setup guides, and Git repository templates.</p>
            </div>
            <div className="surface-raised bg-card p-6">
              <ShieldCheck className="mb-4 h-8 w-8 text-brand-sky" />
              <h4 className="font-heading text-lg font-bold">Secure & Risk-Free</h4>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">The discovery call prevents you from buying more hours than you actually need. We only move forward if I can genuinely help you.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAQ Section */}
      <section className="bg-muted/20 py-20 lg:py-28 border-b border-border">
        <div className="mx-auto w-full max-w-3xl px-5 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="font-heading text-3xl font-black tracking-tight">Frequently Asked Questions</h2>
          </div>
          
          <div className="flex flex-col border-t border-border">
            {faqs.map((faq, i) => (
              <details key={i} className="group border-b border-border [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between py-6 font-heading text-lg font-bold text-foreground transition-colors hover:text-primary">
                  {faq.q}
                  <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <div className="pb-8 text-base leading-relaxed text-muted-foreground">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Final Call to Action */}
      <section className="bg-brand-ink py-24 text-center text-white relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-[300px] bg-primary/20 blur-[120px] pointer-events-none"></div>
        <div className="mx-auto max-w-4xl px-5 sm:px-6 lg:px-8 relative z-10">
          <h2 className="font-heading text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Stop guessing. Start building.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
            Book your discovery call today and let's map out exactly how to bring your digital tool to life.
          </p>
          <div className="mt-10">
            <Link className="btn-primary px-10 py-5 text-lg shadow-lg shadow-primary/20" href="/private-ai-build-coaching/apply">
              Apply for the Discovery Call <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

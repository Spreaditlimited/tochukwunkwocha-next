import Image from "next/image"
import Link from "next/link"
import {
  Award,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Cpu,
  CreditCard,
  Database,
  GitBranch,
  Github,
  Globe2,
  Laptop,
  MonitorPlay,
  Play,
  Rocket,
  ShieldCheck,
  Smartphone,
  Star,
  Terminal,
  Video
} from "lucide-react"

import { PublicVideoSlotPlayer } from "@/components/PublicVideoSlotPlayer"
import { PromptToProfitMark, TrademarkText } from "@/components/TrademarkText"
import { CourseAccessibilitySection } from "@/components/courses/CourseAccessibilitySection"
import { TestimonialQuote } from "@/components/courses/TestimonialQuote"
import { getPublicVideoSlot } from "@/lib/public-video-slots"
import type { getCourse } from "@/lib/public-offers"

type Course = NonNullable<ReturnType<typeof getCourse>>

const sectionContainer = "site-container"

export async function PromptToProfitAdvancedCoursePage({ course }: { course: Course }) {
  const introductionVideo = await getPublicVideoSlot("prompt-to-profit-advanced-intro")
  const tools = [
    { name: "Visual Studio Code", icon: Terminal },
    { name: "Git", icon: GitBranch },
    { name: "GitHub", icon: Github },
    { name: "AI Coding Assistants", icon: Cpu },
    { name: "Next.js", icon: Globe2 },
    { name: "Cloud Databases", icon: Database },
    { name: "Mobile Dev Tools", icon: Smartphone },
    { name: "Deployment Platforms", icon: Rocket }
  ]

  const faqs = [
    {
      q: "Do I need to complete Prompt to Profit Basic first?",
      a: "Prompt to Profit Basic is the recommended pathway because it provides the practical foundation this programme builds upon. Learners with equivalent experience may also be able to join."
    },
    {
      q: "Will I build a real application?",
      a: "Yes. Every learner builds a complete Expense Tracker for both the web and mobile while following a structured development workflow."
    },
    {
      q: "Do I need previous software development experience?",
      a: "No professional experience is required, but you should already be comfortable building basic websites and working with AI before joining this programme."
    },
    {
      q: "Will I learn how databases work?",
      a: "Yes. You will learn databases in a practical, beginner-friendly way so you understand how modern applications store and manage information without being overwhelmed by unnecessary theory."
    },
    {
      q: "Will I integrate online payments?",
      a: "Yes. As part of the learning experience, you will integrate a payment gateway into your application to understand how online payments work in modern software."
    },
    {
      q: "Will I receive a certificate?",
      a: "Yes. Your certificate is awarded after successfully completing and submitting your project."
    },
    {
      q: "How long do I have access?",
      a: "You will receive one full year of access to the lessons, recordings, and course materials."
    }
  ]

  const testimonials = [
    {
      name: "Okoyeocha Uchenna",
      role: "Prompt to Profit Advanced Student",
      image: "/testimonials/okoyeocha.png",
      quote: "Done with the Basic class and currently on the Advance class, and honestly, I am already proud of myself seeing the amazing things I can do with AI. And for the tutor? He's the best of the best."
    },
    {
      name: "Rosemary Blessing Alor",
      role: "Parent",
      image: "/testimonials/rosemary-blessing-alor.png",
      href: "https://www.google.com/maps/contrib/112259479462126393325/reviews?hl=en-GB",
      quote: "Mr. Tochukwu is a patient teacher. He is calm and understanding, always willing to explain again to students who have a hard time catching up. The class is enlightening as well. My daughter can do so much now with the things she has learned and I'm glad I enrolled her in this course."
    },
    {
      name: "Francis Balogun",
      role: "Prompt to Profit Advanced Student",
      image: "/testimonials/francis balogun.JPG",
      quote: "Just wanted to say a massive thank you! Enrolling in your build-it-yourself course was a complete turning point.\n\nApplying what you taught allowed me to build my first restaurant margin intelligence solution, and now I’ve built Flock, a church management platform. Your practical approach made all the difference.\n\nYour course literally shifted me from thinking about ideas to shipping actual products."
    },
    {
      name: "Louis Obinna Odionye",
      role: "Prompt to Profit Advanced Student",
      image: "/testimonials/louis obinna odionye.JPG",
      quote: "Hello Mr. Tochukwu, I just wanted to say a big thank you for your Prompt to Profit Advanced Class. Through your AI-powered web and mobile app development training, I've gone from learning the concepts to actually building my own inventory management application, LOTrack.\n\nThe knowledge, practical approach, and guidance you shared gave me the confidence to turn an idea into a real product. I'm still improving it, but I'm proud of how far I've come, and I couldn't have achieved this without your training.\n\nThank you once again for your dedication and for inspiring us to build with AI. I truly appreciate your impact.\n\nGod bless you, sir."
    },
    {
      name: "Anaekee Paschal Ifechukwu",
      role: "Prompt to Profit Advanced Student",
      image: "/testimonials/Anaekee Paschal Ifechukwu.JPG",
      quote: "Firstly when I initially started this advanced class I was really nervous 😬. I was always saying “God pls let me not disappoint oo” but along the line I saw this was way easier than I thought only if u have proper guidance.\n\nI remembered you would always say “Don’t be scared” and today I can confidently stand anywhere and say I can develop a wonderful website.\n\nAll thanks to you sir, you are a rare gem 💎."
    }
  ]

  return (
    <main>
      <section className="relative overflow-hidden bg-brand-ink pt-16 text-white lg:pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sky/15 blur-[150px]" />

        <div className={`${sectionContainer} relative z-10 pb-20 lg:pb-28`}>
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-sky-400">
                <PromptToProfitMark suffix=" Advanced" />
              </p>
              <span className="flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-sky-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
                </span>
                Applications Now Open
              </span>
            </div>

            <h1 className="font-heading text-5xl font-black tracking-tighter sm:text-6xl lg:text-7xl lg:leading-[1.1]">
              Build Production-Ready Web & Mobile Apps <span className="bg-gradient-to-r from-sky-400 to-primary bg-clip-text text-transparent">with AI.</span>
            </h1>
            <p className="mt-6 text-xl font-medium text-slate-300">
              Learn the modern software development workflow used by professional engineering teams.
            </p>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
              <TrademarkText text="Designed for learners who are ready to move beyond simple websites. If Prompt to Profit Basic taught you how to build, Prompt to Profit Advanced teaches you how to build with structure, confidence, and a professional workflow." />
            </p>

            <div className="mx-auto mt-10 flex max-w-xl flex-col items-center justify-center gap-4 sm:flex-row">
              <Link className="btn-primary w-full px-8 py-4 text-base shadow-lg shadow-primary/20 sm:w-auto" href={course.checkoutHref}>
                Enroll Now
              </Link>
              <Link className="btn-secondary w-full px-8 py-4 text-base sm:w-auto" href="#video">
                <Play className="mr-2 h-4 w-4" /> Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background py-10">
        <div className={sectionContainer}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Duration", value: "4 Weeks", icon: Calendar },
              { label: "Delivery", value: "Recorded + Live", icon: Video },
              { label: "Project", value: "Expense Tracker", icon: Laptop },
              { label: "Skill Level", value: "Intermediate", icon: ShieldCheck },
              { label: "Access", value: "One Full Year", icon: MonitorPlay },
              { label: "Prerequisite", value: "Basic or equivalent", icon: CheckCircle2 }
            ].map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="surface-raised flex flex-col items-center justify-center bg-card p-6 text-center">
                  <Icon className="mb-3 h-6 w-6 text-sky-500" />
                  <p className="font-heading font-bold text-foreground">{stat.value}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section id="video" className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
              <p className="eyebrow text-sky-500">Welcome</p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
                <PromptToProfitMark suffix=" Advanced" />
              </h2>
              <div className="mt-6 space-y-4 text-lg leading-relaxed text-muted-foreground">
                <p><TrademarkText text="In this short introduction, Tochukwu Nkwocha explains why Prompt to Profit Advanced was created, what you will build during the programme, and how it differs from the Basic programme." /></p>
                <p className="font-bold text-foreground">Discover why understanding the modern software development workflow is becoming one of the most valuable digital skills today.</p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 -z-10 rotate-2 rounded-2xl bg-brand-ink/5" />
              <PublicVideoSlotPlayer
                slot={introductionVideo}
                className="aspect-video w-full cursor-pointer rounded-2xl bg-brand-ink text-white shadow-xl"
                emptyMessage="Configure the Prompt to Profit Advanced introduction video from the internal Video Library."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:h-fit">
              <p className="eyebrow text-sky-500">The Modern Standard</p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
                Bridge the Gap Between Code Generation and Software Engineering.
              </h2>
            </div>

            <div className="space-y-12">
              <div className="surface-raised bg-card p-8 sm:p-10">
                <div className="mb-6 inline-flex rounded-lg bg-sky-500/10 p-3 text-sky-500">
                  <GitBranch className="h-6 w-6" />
                </div>
                <h3 className="font-heading text-2xl font-black"><PromptToProfitMark suffix=" Advanced" /> Exists</h3>
                <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground">
                  <p>Artificial Intelligence has dramatically changed software development. Today, building software is no longer limited to people who have spent years learning traditional programming.</p>
                  <p>However, there is an important difference between generating code and building software well. Modern applications require structure, planning, organisation, testing, deployment, and continuous improvement.</p>
                  <p className="font-bold text-foreground">Instead of teaching isolated coding techniques, we teach you how to work directly with AI while following a practical development workflow that closely reflects how modern software products are created.</p>
                </div>
              </div>

              <div className="surface-raised border-sky-500/20 bg-brand-ink p-8 text-white sm:p-10">
                <div className="mb-6 inline-flex rounded-lg bg-white/10 p-3 text-sky-400">
                  <Cpu className="h-6 w-6" />
                </div>
                <h3 className="font-heading text-2xl font-black">Build With AI. Do Not Become Dependent.</h3>
                <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-300">
                  <p>New AI website and app builders appear almost every week. Many of them can become expensive, limit your flexibility, and hide much of the building process from the person using them.</p>
                  <p>Throughout this programme, you will work directly with widely available AI tools, including the free versions of ChatGPT, Gemini, and Claude.</p>
                  <p className="font-bold text-sky-400">Rather than asking AI to build everything in one step, you will learn how to guide it through each stage of development, gradually creating applications while understanding how they work.</p>
                </div>
              </div>

              <div className="surface-raised bg-card p-8 sm:p-10">
                <div className="mb-6 inline-flex rounded-lg bg-sky-500/10 p-3 text-sky-500">
                  <Terminal className="h-6 w-6" />
                </div>
                <h3 className="font-heading text-2xl font-black">The Workflow of Modern Software Teams</h3>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  Building software today is about far more than writing code. You will gain practical experience using many of the same tools trusted by software engineers around the world:
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  {tools.map((tool) => {
                    const Icon = tool.icon
                    return (
                      <span key={tool.name} className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-4 py-2 text-sm font-semibold text-foreground shadow-sm">
                        <Icon className="h-4 w-4 text-sky-500" /> {tool.name}
                      </span>
                    )
                  })}
                </div>
                <p className="mt-8 border-t border-border pt-6 text-base font-bold text-foreground">
                  We do not teach these as isolated technologies. You will use them naturally while building a complete application.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div>
              <p className="eyebrow text-sky-500">The Project</p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
                What You Will Build
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                Throughout the programme, every learner builds a complete <strong className="text-foreground">Expense Tracker application</strong> from the ground up for both web and mobile.
              </p>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                Unlike classroom demonstrations, this is a practical software project that gradually grows into a complete system. Features include:
              </p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  "Secure user authentication",
                  "Personal user accounts",
                  "Income tracking",
                  "Expense tracking",
                  "Categories",
                  "Dashboards",
                  "Reports",
                  "Database integration",
                  "Payment gateway integration",
                  "Mobile application",
                  "Responsive web app",
                  "Live deployment"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-sky-500" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 -z-10 rotate-2 rounded-2xl bg-sky-500/10" />
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
                <Image
                  src="/PocketBudgetScreenShot.png"
                  alt="PocketBudget expense tracker dashboard preview"
                  width={2538}
                  height={1720}
                  className="h-auto w-full object-cover"
                  sizes="(min-width: 1024px) 42vw, 100vw"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <p className="eyebrow text-sky-500">Structured Path</p>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
              Programme Curriculum
            </h2>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {[
              {
                week: "Week 1",
                title: "Build Your Professional Environment",
                body: "Every successful software project begins with a well-organised workspace. Set up your development environment and become comfortable with the workflow followed by modern software teams.",
                topics: ["VS Code & Git Setup", "GitHub Project Management", "AI Coding Assistants", "Next.js Project Creation", "Cloud Database Prep"]
              },
              {
                week: "Week 2",
                title: "Build Your Web Application",
                body: "With your environment ready, begin building the web version of your Expense Tracker. Work alongside AI to develop each feature step by step while learning application architecture.",
                topics: ["Reusable Components", "Secure Authentication", "Live Database Connection", "Dashboards & Reports", "Testing As You Build"],
                dark: true
              },
              {
                week: "Week 3",
                title: "Build Your Mobile Application",
                body: "Modern users expect software to work everywhere. Build the mobile version of your tracker and integrate an online payment gateway to understand complex business flows.",
                topics: ["Mobile Interface Design", "Shared App Logic", "Testing on Devices", "Secure Payment Flows", "Refining UX"],
                dark: true
              },
              {
                week: "Week 4",
                title: "Test, Deploy and Launch",
                body: "Building software is only part of the journey. Prepare your applications for real users. Learn how to identify problems, improve quality, publish, and continue developing.",
                topics: ["Debugging Common Issues", "Performance Optimization", "Web App Deployment", "Mobile App Publishing", "Managing Updates"]
              }
            ].map((week, index) => (
              <div key={week.week} className={`surface-raised relative overflow-hidden p-8 sm:p-10 ${week.dark ? "bg-brand-ink text-white" : "bg-card"}`}>
                <span className={`absolute -right-4 -top-6 select-none font-heading text-[10rem] font-black leading-none ${week.dark ? "text-white/5" : "text-muted/40"}`}>
                  {index + 1}
                </span>
                <div className="relative z-10">
                  <p className={`eyebrow mb-2 ${week.dark ? "text-sky-400" : "text-sky-500"}`}>{week.week}</p>
                  <h3 className={`font-heading text-2xl font-black ${week.dark ? "text-white" : ""}`}>{week.title}</h3>
                  <p className={`mt-4 text-sm leading-relaxed ${week.dark ? "text-slate-300" : "text-muted-foreground"}`}>
                    {week.body}
                  </p>
                  <div className={`mt-8 border-t pt-6 ${week.dark ? "border-white/10" : "border-border"}`}>
                    <p className={`mb-4 text-xs font-bold uppercase tracking-widest ${week.dark ? "text-slate-400" : "text-muted-foreground"}`}>Topics Include</p>
                    <ul className={`grid gap-2 text-sm font-medium sm:grid-cols-2 ${week.dark ? "text-slate-200" : "text-foreground"}`}>
                      {week.topics.map((topic) => (
                        <li key={topic}>• {topic}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-brand-ink py-20 text-white lg:py-32">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 bg-sky-500/20 blur-[120px]" />

        <div className="relative z-10">
          <div className={`${sectionContainer} mb-12 text-center`}>
            <div className="mx-auto mb-6 inline-flex items-center justify-center gap-1 text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-6 w-6 fill-yellow-400" />
              ))}
            </div>
            <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              What our builders are saying
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
              Join hundreds of learners who have transformed their ideas into live platforms.
            </p>
          </div>

          <div className="relative max-w-[100vw] overflow-hidden">
            <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 hidden w-32 bg-gradient-to-r from-brand-ink to-transparent lg:block" />
            <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 hidden w-32 bg-gradient-to-l from-brand-ink to-transparent lg:block" />

            <div className="grid gap-6 px-5 pb-8 pt-4 sm:px-6 md:flex md:items-start md:snap-x md:snap-mandatory md:overflow-x-auto lg:px-8 md:[scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden">
              {testimonials.map((testimonial) => (
                <article
                  key={testimonial.name}
                  className="flex w-full min-w-0 flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.02] p-8 shadow-xl backdrop-blur-sm transition-colors hover:bg-white/[0.04] md:w-[420px] md:flex-none md:snap-center"
                >
                  <div>
                    <div className="mb-6 flex gap-1 text-yellow-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                    <TestimonialQuote quote={testimonial.quote} />
                  </div>

                  <div className="mt-10 flex items-center gap-4 border-t border-white/10 pt-6">
                    <div className="relative h-12 w-12 shrink-0">
                      <Image
                        src={testimonial.image}
                        alt={testimonial.name}
                        fill
                        className="rounded-full object-cover shadow-lg ring-2 ring-white/20"
                      />
                    </div>
                    <div className="min-w-0">
                      {testimonial.href ? (
                        <Link href={testimonial.href} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-bold text-white transition-colors hover:text-sky-400">
                          {testimonial.name}
                        </Link>
                      ) : (
                        <h3 className="truncate text-sm font-bold text-white">{testimonial.name}</h3>
                      )}
                      <p className="mt-1 truncate font-mono text-xs tracking-wide text-sky-400">
                        <TrademarkText text={testimonial.role} />
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="surface-raised relative overflow-hidden bg-brand-ink p-8 text-white sm:p-12">
              <Award className="mb-6 h-10 w-10 text-sky-400" />
              <h3 className="font-heading text-2xl font-black tracking-tight lg:text-3xl">A Certificate That Demonstrates Real Ability</h3>
              <div className="mt-6 space-y-4 leading-relaxed text-slate-300">
                <p>Watching lessons is only the beginning. To earn your certificate, you must complete and submit your project.</p>
                <p>Each certificate includes a verification link connected to the application you built, allowing employers, clients, and collaborators to see practical evidence of your work.</p>
                <p className="mt-4 font-bold text-white">Your certificate reflects demonstrated ability rather than course attendance.</p>
              </div>
            </div>

            <div className="surface-raised bg-muted/30 p-8 sm:p-12">
              <CreditCard className="mb-6 h-10 w-10 text-sky-500" />
              <h3 className="font-heading text-2xl font-black tracking-tight lg:text-3xl">Pay In Installments</h3>
              <div className="mt-6 space-y-4 leading-relaxed text-muted-foreground">
                <p>Investing in advanced digital skills should not require paying everything upfront.</p>
                <p>Our flexible instalment payment system allows you to spread your payments over time. Your place is reserved while you complete your payments.</p>
                <p>This gives you the flexibility to plan your learning around your finances without missing the opportunity to join.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid items-center gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="relative">
              <div className="absolute -inset-4 -z-10 -rotate-2 rounded-2xl bg-sky-500/10" />
              <Image
                src="/brand/tochukwu-portrait.webp"
                alt="Tochukwu Nkwocha"
                width={720}
                height={900}
                className="aspect-[4/5] w-full rounded-xl bg-brand-ink object-cover shadow-xl"
              />
            </div>

            <div>
              <p className="eyebrow text-sky-500">Meet Your Lead Instructor</p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
                About Tochukwu Nkwocha
              </h2>
              <div className="mt-6 space-y-5 text-lg leading-relaxed text-muted-foreground">
                <p>I build real digital tools for real businesses, but my passion is making complex technology simple enough for ordinary people to understand and use.</p>
                <p>Before AI became widely available, I had already built platforms like Sure Imports and Effiko. Sure Imports has grown to more than <strong className="text-foreground">40,000 users</strong>, while Effiko has recorded over <strong className="text-foreground">10,000 app downloads</strong> and more than <strong className="text-foreground">500,000 yearly Google impressions</strong>.</p>
                <p><TrademarkText text="Everything taught in Prompt to Profit Advanced comes directly from practical experience building real software." /></p>
                <p className="font-bold text-foreground">My goal is to help you understand not just how to generate code with AI, but how to organise, build, improve, and deploy complete applications with confidence.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CourseAccessibilitySection courseName={<PromptToProfitMark suffix=" Advanced" />} />

      <section className="bg-background py-20 lg:py-28">
        <div className="mx-auto w-full max-w-3xl px-5 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="font-heading text-3xl font-black tracking-tight">Frequently Asked Questions</h2>
          </div>

          <div className="flex flex-col border-t border-border">
            {faqs.map((faq) => (
              <details key={faq.q} className="group border-b border-border [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-6 py-6 font-heading text-lg font-bold text-foreground transition-colors hover:text-sky-500">
                  {faq.q}
                  <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <div className="pb-8 text-base leading-relaxed text-muted-foreground"><TrademarkText text={faq.a} /></div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="enroll" className="relative overflow-hidden bg-brand-ink py-24 text-center text-white">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 bg-sky-500/20 blur-[120px]" />
        <div className="relative z-10 mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
          <p className="eyebrow mb-6 text-sky-400">Take the Next Step</p>
          <h2 className="font-heading text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Ready to Build Like a Professional?
          </h2>
          <div className="mx-auto mt-6 max-w-2xl space-y-4 text-lg leading-relaxed text-slate-300">
            <p><TrademarkText text="Prompt to Profit Advanced is designed for learners who want to move beyond simple projects and experience how modern software is built." /></p>
            <p>You will graduate with practical experience building web and mobile applications, confidence using professional tools, and a workflow you can continue applying to future projects.</p>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link className="btn-primary px-8 py-4 text-base shadow-lg shadow-primary/20" href={course.checkoutHref}>
              Enroll Now
            </Link>
            <Link className="btn-inverse-secondary px-8 py-4 text-base" href="#video">
              <Play className="mr-2 h-4 w-4" /> Learn More
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  Award,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Code2,
  Cpu,
  CreditCard,
  Globe2,
  Laptop,
  LayoutDashboard,
  Lightbulb,
  MonitorPlay,
  Play,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Video
} from "lucide-react"

import { PublicVideoSlotPlayer } from "@/components/PublicVideoSlotPlayer"
import { PromptToProfitMark, TrademarkText } from "@/components/TrademarkText"
import { CourseAccessibilitySection } from "@/components/courses/CourseAccessibilitySection"
import { CourseFeeDisplay } from "@/components/courses/CourseFeeDisplay"
import { TestimonialQuote } from "@/components/courses/TestimonialQuote"
import { cohortEnrollmentLabel } from "@/lib/course-cohort-label"
import { getPublicVideoSlot } from "@/lib/public-video-slots"
import type { PublicCourseSettings } from "@/lib/public-course-settings"
import type { getCourse } from "@/lib/public-offers"
import type { SiteShowcase } from "@/lib/site-showcases"
import { formatDateTimeWAT } from "@/lib/utils"

type Course = NonNullable<ReturnType<typeof getCourse>>

const sectionContainer = "site-container"

function batchSequence(value: string) {
  const match = value.match(/\bbatch[\s_-]*(\d+)\b/i)
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY
}

export async function PromptToProfitCoursePage({
  course,
  courseSettings,
  studentWebsites
}: {
  course: Course
  courseSettings: PublicCourseSettings | null
  studentWebsites: SiteShowcase[]
}) {
  const introductionVideo = await getPublicVideoSlot("prompt-to-profit-basic-intro")
  const openBatches = [...(courseSettings?.openBatches || [])].sort((left, right) => {
    const sequenceDifference = batchSequence(left.batchLabel || left.batchKey) - batchSequence(right.batchLabel || right.batchKey)
    if (sequenceDifference) return sequenceDifference
    return (left.batchStartAt || "").localeCompare(right.batchStartAt || "")
  })
  const enrollmentStatus = courseSettings
    ? courseSettings.isEnrollmentLocked
      ? "Enrollment locked"
      : openBatches.length
        ? "Enrollment open"
        : "No open batches"
    : "Course settings not found"
  const enrollmentBadge = cohortEnrollmentLabel(openBatches)

  const buildProjects = [
    "Business websites",
    "Personal portfolio websites",
    "Interactive Web Games",
    "Quiz and Learning Games",
    "Creative Story Experiences",
    "Educational Tools",
    "Inventory Management Systems",
    "Expense Trackers",
    "Invoice Generators",
    "Customer Management Tools",
    "Staff Record Systems",
    "Appointment Booking Systems",
    "Product Catalogues",
    "School Record Tools",
    "Business Dashboards",
    "Event Registration Systems",
    "Landing Pages",
    "Business Calculators",
    "Internal Company Tools",
    "Simple Client Portals"
  ]

  const youngLearnerProjects = [
    {
      title: "Bear & Harvest: Cozy Kitchen",
      url: "https://bear-harest.netlify.app/",
      host: "bear-harest.netlify.app"
    },
    {
      title: "Wellness Garden",
      url: "https://welfareworld.netlify.app/wellness",
      host: "welfareworld.netlify.app/wellness"
    },
    {
      title: "SmartStock",
      url: "https://exquisite-cajeta-af63da.netlify.app/",
      host: "exquisite-cajeta-af63da.netlify.app"
    }
  ]

  const featuredTransformationProjects = [
    {
      title: "M-Philz Wears",
      badge: "Learner Project",
      isYoungLearner: false,
      url: "https://splendorous-marzipan-6befc0.netlify.app/",
      host: "splendorous-marzipan-6befc0.netlify.app"
    },
    {
      title: "Hybrid Academy Inventory & Fee Manager",
      badge: "Learner Project",
      isYoungLearner: false,
      url: "https://legendary-mochi-24add5.netlify.app/",
      host: "legendary-mochi-24add5.netlify.app"
    },
    {
      title: "Bear & Harvest: Cozy Kitchen",
      badge: "Young Learner Project",
      isYoungLearner: true,
      url: "https://bear-harest.netlify.app/",
      host: "bear-harest.netlify.app"
    }
  ]

  const learnerWebsiteTitles: Record<string, string> = {
    "splendorous-marzipan-6befc0.netlify.app": "M-Philz Wears",
    "themancavenaija.com": "The ManCave Naija"
  }

  const visibleStudentWebsites = studentWebsites.flatMap((site) => {
    try {
      const hostname = new URL(site.url).hostname.replace(/^www\./i, "").toLowerCase()
      if (hostname === "olytribe.com.ng") return []
      if (hostname === "treshatrendy.vercel.app") {
        return [{
          ...site,
          title: "Hybrid Academy Inventory & Fee Manager",
          url: "https://legendary-mochi-24add5.netlify.app/",
          displayUrl: "legendary-mochi-24add5.netlify.app"
        }]
      }
      return [{
        ...site,
        title: learnerWebsiteTitles[hostname] || site.title
      }]
    } catch {
      return site.url.toLowerCase().includes("olytribe.com.ng") ? [] : [site]
    }
  })

  const softwareWorkbooks = [
    {
      number: "01",
      title: "Expense Tracker",
      description: "Build a secure application for recording expenses, calculating totals, and understanding spending.",
      cover: "/shop/workbooks/expense-tracker-cover.png"
    },
    {
      number: "02",
      title: "Customer Record Management System",
      description: "Create a practical system for organising, updating, and securely managing customer information.",
      cover: "/shop/workbooks/customer-record-management-system-cover.png"
    },
    {
      number: "03",
      title: "Professional Quotation Generator",
      description: "Develop a business tool for creating, saving, editing, and printing professional quotations.",
      cover: "/shop/workbooks/professional-quotation-generator-cover.png"
    },
    {
      number: "04",
      title: "Professional Invoice Generator",
      description: "Build a secure application that calculates, stores, and prints professional business invoices.",
      cover: "/shop/workbooks/professional-invoice-generator-cover.png"
    },
    {
      number: "05",
      title: "Appointment Booking System",
      description: "Create a complete booking workflow that helps a business receive and manage appointments.",
      cover: "/shop/workbooks/appointment-booking-system-cover.png"
    }
  ]

  const programmeSteps = [
    {
      day: "Day 1",
      format: "Live Welcome Session",
      title: "Your Journey Begins",
      icon: Users,
      paragraphs: [
        "Meet your Lead Instructor and fellow learners as we kick off the programme together.",
        "You’ll discover what Artificial Intelligence can and cannot do, understand how this programme is different from traditional AI courses, and develop the mindset needed to build confidently with AI.",
        "The session also includes a live demonstration showing how AI can be used to create practical websites and digital tools, giving you a clear picture of what you’ll be building over the coming days."
      ]
    },
    {
      day: "Day 2",
      format: "Recorded Lessons",
      title: "Build Your First Website",
      icon: Laptop,
      paragraphs: [
        "This is where the real building begins.",
        "You’ll learn how websites are organised, how to communicate effectively with AI to generate and improve code, and how to guide AI instead of simply accepting whatever it produces.",
        "By the end of the day, you’ll have built the first version of your own professional website."
      ]
    },
    {
      day: "Day 3",
      format: "Recorded Lessons",
      title: "Improve and Expand Your Website",
      icon: Code2,
      paragraphs: [
        "Building is only the first step. Great digital products are refined over time.",
        "Working closely with AI, you’ll improve the design, structure, and functionality of your website while learning how to review, refine, and enhance AI-generated work.",
        "Every improvement helps you develop the confidence to build better projects in the future."
      ]
    },
    {
      day: "Day 4",
      format: "Recorded Lessons",
      title: "Publish Your Website",
      icon: Globe2,
      paragraphs: [
        "A website isn’t complete until people can visit it.",
        "You’ll prepare your website for launch and publish it online using one of the simplest deployment methods available, without complicated server setup or technical configuration.",
        "By the end of the day, you’ll have a live website with a shareable web address that you can proudly show to family, friends, employers, or clients."
      ]
    },
    {
      day: "Day 5",
      format: "Recorded Lessons + Live Session",
      title: "Build and Launch Your First Software",
      icon: LayoutDashboard,
      featured: true,
      paragraphs: [
        "On the final day, you’ll take the next step from websites to software.",
        "You’ll build a simple but practical software application, connect it to a database, create secure user authentication, develop a functional dashboard, and deploy your completed project online.",
        "This final project brings together everything you’ve learned throughout the programme and demonstrates how AI can help complete beginners build useful digital tools from the ground up."
      ]
    }
  ]

  const faqs = [
    {
      q: "I am completely non-techy. Can I really take this course?",
      a: "Yes. This course was created for complete beginners. If you can use a browser, type, and follow simple instructions, you can take this course."
    },
    {
      q: "Is this course suitable for children?",
      a: "Yes. Children from about age 8 and above can take it, especially if they can read, type, and use a computer. Younger children may benefit from having a parent nearby."
    },
    {
      q: "Do parents need to know coding to help their children?",
      a: "No. Parents do not need any coding knowledge. Some parents choose to learn alongside their children, but older children can follow the lessons independently."
    },
    {
      q: "Is this only for job seekers?",
      a: "No. Prompt to Profit Basic is useful for job seekers, children, students, parents, professionals, entrepreneurs, business owners, teachers, and anyone who wants practical AI skills."
    },
    {
      q: "Will I learn full professional software development?",
      a: "No. This programme teaches you how to work with AI to build practical websites and simple digital tools. If your goal is to build larger and more sophisticated applications, Prompt to Production is the next step."
    },
    {
      q: "How are the classes delivered?",
      a: "You will receive access to professionally recorded lessons through your learning dashboard, together with live Zoom sessions for demonstrations, project reviews, questions, and support."
    },
    {
      q: "What happens if I miss a live session?",
      a: "Every live session is recorded and added to your learning dashboard, allowing you to watch it later."
    },
    {
      q: "How long do I have access?",
      a: "You will receive one full year of access to the lessons, recordings, and course materials."
    },
    {
      q: "What kind of computer do I need?",
      a: "Any basic laptop or desktop computer with internet access and a modern web browser is sufficient. You do not need an expensive computer."
    },
    {
      q: "Will I receive a certificate?",
      a: "Yes. After completing your project and submitting the project link, you will receive a verified certificate that links directly to the work you built."
    },
    {
      q: "What if I get stuck?",
      a: "Support is available through the live sessions, the student discussion area, and the recorded lessons, which you can revisit whenever you need them."
    }
  ]

  const testimonials = [
    {
      name: "Okoyeocha Uchenna",
      role: "Prompt to Profit Student",
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
      name: "Adedayo Adewoye",
      role: "Prompt to Profit Student",
      image: "/testimonials/adedayo-adewoye.png",
      quote: "This was a really impactful training session. I never knew one could do so much in website and application development using AI. This course however, helped me learn this in just 5 days and I have been perfecting it ever since then. I gladly recommend the programmes to anyone else who wants to learn how to use AI for building solutions."
    },
    {
      name: "Anuri Okongwu",
      role: "Parent & Advocate",
      image: "/testimonials/anuri-avatar.webp",
      quote: "Your Prompt to Profit class was so good. Your teaching ability is topnotch. I registered the course for my two boys in secondary school, and they have now built their own websites by following the steps in the course."
    },
    {
      name: "Buchi Ileka",
      role: "Parent",
      image: "/testimonials/buchi-avatar.webp",
      quote: "I enrolled my 8-year-old in Prompt to Profit, and by Day 3 he had already built three practice websites on his own. He was so excited to show me everything he made."
    },
    {
      name: "Marquis Festus",
      role: "Father of an 8-year old",
      image: "/testimonials/marquis-avatar.webp",
      quote: "My daughter is 8 years old. Last month, she built a landing page for her dream fashion business using what she picked up from Prompt to Profit. No coding. No prior experience. The proof that a course works is not in the certificate. It is in what the student builds when the class ends."
    },
    {
      name: "Ekpereamaka Blessings",
      role: "Beginner Student",
      image: "/testimonials/ekpere-avatar.webp",
      quote: "I built a website for my company for $100 and my boss was impressed. I had more offers from his two friends."
    },
    {
      name: "Michelle Emoghware",
      role: "Beginner Student",
      image: "/testimonials/michelle-avatar.webp",
      quote: "I built a beautiful, professional-looking website using the knowledge gained on Day 1. My biggest takeaway was how to literally discuss the problems I was having with AI and prompt a solution."
    },
    {
      name: "Charity Chinedu-Ogbu",
      role: "Beginner Student",
      image: "/testimonials/chinenye-avatar.webp",
      quote: "When you double clicked the HTML file and the site came up, it first looked like magic. You are such an amazing teacher with a full dose of patience."
    },
    {
      name: "Williams Ghomorai",
      role: "Beginner Student",
      image: "/testimonials/williams-ghamorai-avatar.webp",
      quote: "Before I met Tochukwu Tech and AI Academy, I had been stalling about learning how to build landing pages or websites. The fear of so many technical jargons prevented me from actually learning even though I had video courses. But when I joined TTA cohort 3, the fear disappeared and I don't need to know how to code to build web solutions. He made it so easy and now I am able to build websites just by interacting with AI."
    },
    {
      name: "Love Chuks",
      role: "Beginner Student",
      image: "/testimonials/love-chuks-avatar.webp",
      quote: "Very detailed teaching and easy to understand, Mr Tochukwu is always ready to correct and very patient with his students. I was a complete novice but couldn't believe what I achieved through this course."
    },
    {
      name: "Shola Akinwunmi",
      role: "Beginner Student",
      image: "/testimonials/shola-akinwunmi-avatar.webp",
      quote: "An awesome instructor of artificial intelligence. Highly recommend any day and anytime."
    },
    {
      name: "Isaac Akinseye",
      role: "Beginner Student",
      image: "/testimonials/isaac-akinseye-avatar.webp",
      quote: "Highly recommended. Amazing Course. Great Teacher. You would be amazed at what you can start building even from Day 1 of the course."
    },
    {
      name: "Jamike Ugochukwu Okoroji",
      role: "Beginner Student",
      image: "/testimonials/jamike-ugochukwu-avatar.webp",
      quote: "Very simple practical class that when meticulously followed one can build websites by prompts in less than 24 hrs. I built two websites in less that 24hrs! Thank you coach Tochukwu!"
    }
  ]

  return (
    <main>
      <section className="relative overflow-hidden bg-brand-ink pt-16 text-white lg:pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sky/15 blur-[150px]" />

        <div className={`${sectionContainer} relative z-10 pb-20 lg:pb-28`}>
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div className="text-center lg:text-left">
              <div className="mb-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <p className="font-mono text-xs font-bold uppercase tracking-widest text-sky-400"><PromptToProfitMark suffix=" Basic" /></p>
                <span className="flex max-w-full items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase leading-5 tracking-wide text-emerald-400 sm:tracking-widest">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  {enrollmentBadge}
                </span>
              </div>

              <h1 className="font-heading text-5xl font-black tracking-tight sm:text-6xl lg:text-[4rem] lg:leading-[1.1]">
                Build Practical Websites and Digital Tools <span className="bg-gradient-to-r from-sky-400 to-primary bg-clip-text text-transparent">with AI.</span>
              </h1>
              <p className="mt-6 text-xl font-medium text-slate-300">Designed for Complete Beginners. Build on your phone or computer.</p>
              <div className="mt-4 space-y-4 text-lg leading-relaxed text-slate-400">
                <p>
                  Artificial Intelligence has changed how software is built. In five days, you will learn how to think through a digital problem, guide AI step by step, and build practical solutions with confidence.
                </p>
              </div>

              <div className="mx-auto mt-10 flex max-w-xl flex-col items-center justify-center gap-4 sm:flex-row lg:mx-0 lg:justify-start">
                <Link className="btn-primary w-full px-8 py-4 text-center text-base shadow-lg shadow-primary/20 sm:w-auto" href={course.checkoutHref}>
                  Enroll Now
                </Link>
                <Link className="btn-secondary w-full px-8 py-4 text-center text-base sm:w-auto" href="#learner-projects">
                  Learn More
                </Link>
              </div>

              <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex -space-x-3">
                  {testimonials.slice(0, 5).map((testimonial) => (
                    <Image
                      key={testimonial.name}
                      src={testimonial.image}
                      alt={testimonial.name}
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-full border-2 border-brand-ink object-cover shadow-lg ring-1 ring-white/20"
                    />
                  ))}
                </div>
                <div className="w-full text-left sm:w-auto">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-white">Join 800+ Learners</p>
                  <p className="mt-1 text-sm font-medium text-slate-400">Learning to build practical websites and digital tools with AI.</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-b from-sky-400/30 to-primary/30 blur-lg" />
              <div className="relative rounded-2xl border border-white/10 bg-[#0a1120] p-8 shadow-2xl sm:p-10">
                <p className="eyebrow text-sky-400">Course settings</p>
                <h3 className="mt-2 font-heading text-3xl font-black">
                  {courseSettings?.courseTitle || "Prompt to Profit Holiday"}
                </h3>

                <div className="mt-8 border-t border-white/10 pt-6">
                  <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Open batches</p>
                  <p className="mt-2 font-heading text-xl font-bold text-white">
                    {openBatches.length} {openBatches.length === 1 ? "batch" : "batches"} open
                  </p>
                  <p className="mt-2 text-sm font-semibold text-sky-400">{enrollmentStatus}</p>

                  {openBatches.length ? (
                    <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                      {openBatches.map((batch) => {
                        const startLabel = formatDateTimeWAT(batch.batchStartAt)
                        return (
                          <li
                            key={batch.batchKey}
                            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
                          >
                            <div className="flex items-start gap-3">
                              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                              <div>
                                <p className="font-bold text-white">{batch.batchLabel}</p>
                                {startLabel ? (
                                  <p className="mt-1 text-sm font-medium text-slate-300">Starts {startLabel}</p>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm leading-relaxed text-slate-300">
                      There are no future batches available for enrollment right now.
                    </p>
                  )}
                </div>

                <div className="mt-8 border-t border-white/10 pt-6">
                  <p className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-400">Live course details</p>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    <li className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <Calendar className="h-4 w-4 text-primary" />
                      {courseSettings?.enrollmentMode === "batch" ? "5 Days of Learning" : courseSettings?.enrollmentMode || "Enrollment mode not set"}
                    </li>
                    <li className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <MonitorPlay className="h-4 w-4 text-primary" />
                      {courseSettings
                        ? `${courseSettings.activeLessonCount} Recorded ${courseSettings.activeLessonCount === 1 ? "Lesson" : "Lessons"}`
                        : "Recorded Lessons"}
                    </li>
                    <li className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <Video className="h-4 w-4 text-primary" />
                      2 Live Zoom Sessions
                    </li>
                    <li className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <Code2 className="h-4 w-4 text-primary" />
                      5 Software Workbooks
                    </li>
                    <li className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <Users className="h-4 w-4 text-primary" />
                      A Growing Community
                    </li>
                    <li className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      One-Year Access
                    </li>
                    <li className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <Award className="h-4 w-4 text-primary" />
                      Project Certificate
                    </li>
                  </ul>
                  <CourseFeeDisplay prices={courseSettings} tone="dark" className="mt-6" showCheckoutNote />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="learner-projects" className="relative scroll-mt-20 overflow-hidden border-b border-border/60 bg-muted/20 py-16 sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute -left-28 top-0 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -right-28 bottom-0 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />

        <div className={`${sectionContainer} relative`}>
          <div className="mx-auto max-w-4xl text-center">
            <p className="eyebrow inline-flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" /> Built by Our Learners
            </p>
            <h2 className="mt-4 font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Before We Explain the Course, See What Learners Have Already Built.
            </h2>
            <div className="mx-auto mt-6 max-w-3xl space-y-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
              <p>
                These are live projects created by people who learned through <PromptToProfitMark />—from adults building practical business solutions to young learners turning their ideas into interactive digital experiences.
              </p>
              <p>
                The projects are different because the programme does not teach people to reproduce one template. It teaches practical principles they can apply to their own interests, problems, and ideas.
              </p>
            </div>
          </div>

          <div className="mt-12 grid items-start gap-12 md:grid-cols-3 md:gap-6 lg:gap-10">
            {featuredTransformationProjects.map((project) => (
              <article key={project.url} className="group mx-auto w-full max-w-[350px] text-center">
                <div className="relative mx-auto overflow-hidden rounded-[2.4rem] border-[9px] border-slate-950 bg-slate-950 shadow-2xl shadow-black/20 transition-transform duration-300 group-hover:-translate-y-1">
                  <div className="relative flex h-7 items-center justify-center bg-slate-950" aria-hidden="true">
                    <span className="h-1.5 w-16 rounded-full bg-slate-700" />
                  </div>
                  <div className="relative h-[540px] overflow-hidden rounded-b-[1.75rem] bg-white">
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Loading mobile preview…
                    </div>
                    <iframe
                      src={project.url}
                      title={`Mobile preview of ${project.title}`}
                      className="pointer-events-none relative z-10 h-full w-full border-0 bg-white"
                      loading="lazy"
                      tabIndex={-1}
                      referrerPolicy="no-referrer-when-downgrade"
                      sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts"
                    />
                  </div>
                </div>
                <div className="px-3 pt-6">
                  <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${project.isYoungLearner ? "bg-violet-500/10 text-violet-600 dark:text-violet-400" : "bg-sky-500/10 text-sky-600 dark:text-sky-400"}`}>
                    {project.badge}
                  </span>
                  <h3 className="mt-3 font-heading text-xl font-black leading-tight text-foreground">{project.title}</h3>
                  <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{project.host}</p>
                </div>
              </article>
            ))}
          </div>

        </div>
      </section>

      <section id="video" className="bg-background py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">Welcome to <PromptToProfitMark /></h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              <TrademarkText text="In this short introduction, Tochukwu Nkwocha explains why Prompt to Profit was created, how the programme works, what students build, and why learning to work directly with AI is becoming an important digital skill." />
            </p>

            <div className="mt-10">
              <PublicVideoSlotPlayer
                slot={introductionVideo}
                className="aspect-video w-full cursor-pointer rounded-2xl bg-brand-ink text-white shadow-xl"
                emptyMessage="Configure the Prompt to Profit Basic introduction video from the internal Video Library."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:h-fit">
              <p className="eyebrow">The Shift</p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">AI Has Changed Software Development.</h2>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                For decades, building software required years of learning programming languages before someone could create something useful. Artificial Intelligence has changed that.
              </p>
            </div>

            <div className="space-y-12">
              <div className="surface-raised bg-card p-8 sm:p-10">
                <div className="mb-6 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                  <Globe2 className="h-6 w-6" />
                </div>
                <h3 className="font-heading text-2xl font-black">Accessible, not Effortless</h3>
                <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground">
                  <p>Today, ordinary people can work alongside AI to build practical websites and software without spending years studying traditional software engineering.</p>
                  <p>This does not mean software development has become effortless. It means the process has become far more accessible.</p>
                  <p className="font-bold text-foreground">People who understand how to communicate clearly with AI and how digital systems are organised can now build solutions that would previously have required an entire development team.</p>
                </div>
              </div>

              <div className="surface-raised bg-brand-ink p-8 text-white sm:p-10">
                <div className="mb-6 inline-flex rounded-lg bg-white/10 p-3 text-sky-400">
                  <Code2 className="h-6 w-6" />
                </div>
                <h3 className="font-heading text-2xl font-black">Learn AI Without Becoming Dependent</h3>
                <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-300">
                  <p>Every month, new AI tools promise to build websites with a single prompt. Many of them hide the building process from the learner. Someone may generate an application without understanding how it works, how to improve it, or how to fix it.</p>
                  <p>Rather than teaching you to depend on expensive AI builders, we teach you how to work directly with widely available AI tools, including the free versions of ChatGPT, Gemini, and Claude.</p>
                  <p className="font-bold text-sky-400">The goal is not to master one platform. The goal is to develop skills that remain valuable regardless of which AI tools become popular in the future.</p>
                </div>
              </div>

              <div className="surface-raised bg-card p-8 sm:p-10">
                <div className="mb-6 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                  <Cpu className="h-6 w-6" />
                </div>
                <h3 className="font-heading text-2xl font-black">Build with Understanding</h3>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  You do not need to become a professional software developer to benefit from understanding how software works. You will gradually develop an intuitive understanding of ideas such as:
                </p>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {["How websites are organised", "How software stores information", "How dashboards work", "How users sign in", "How systems communicate", "How AI helps build each part"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary" /> {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-base font-bold text-foreground">
                  By the end of the programme, you will understand far more than how to copy prompts. You will understand how to think about building digital tools.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div>
              <p className="eyebrow">Practical Output</p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">What You Will Build</h2>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                The guided class project is a complete <strong className="text-foreground">Inventory Management System</strong>. By building its public website and functional business dashboard, you will learn how the different parts of a real digital product come together.
              </p>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                The inventory system is the teaching project, not the limit of what you can create. Once you understand the underlying principles, you can apply them to business tools, interactive web games, educational experiences, creative projects, and many other ideas. Adults and young learners can each use the same foundation to build around their own interests and goals.
              </p>
            </div>

            <div className="surface-raised bg-brand-ink p-8 sm:p-10">
              <p className="mb-6 font-heading font-bold text-white">Skills applicable to:</p>
              <div className="flex flex-wrap gap-2">
                {buildProjects.map((project) => (
                  <span key={project} className="inline-flex rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
                    {project}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <p className="eyebrow">The Curriculum</p>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">How the Programme Works</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {programmeSteps.map((step, index) => {
              const Icon = step.icon
              const isFeatured = step.featured
              return (
                <div key={step.title} className={`surface-raised relative overflow-hidden p-8 ${isFeatured ? "bg-brand-ink text-white lg:col-span-2" : "bg-card"}`}>
                  <span className={`absolute -right-4 -top-6 select-none font-heading text-[8rem] font-black leading-none ${isFeatured ? "text-white/5" : "text-muted/50"}`}>{index + 1}</span>
                  <div className="relative z-10">
                    <Icon className={`mb-6 h-8 w-8 ${isFeatured ? "text-sky-400" : "text-primary"}`} />
                    <p className={`font-mono text-xs font-bold uppercase tracking-widest ${isFeatured ? "text-sky-400" : "text-primary"}`}>
                      {step.day} • {step.format}
                    </p>
                    <h3 className="font-heading text-xl font-bold">{step.title}</h3>
                    <div className={`mt-4 space-y-4 text-sm leading-relaxed ${isFeatured ? "text-slate-300" : "text-muted-foreground"}`}>
                      {step.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-background py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-primary">
              <CheckCircle2 className="h-4 w-4" /> Included with your enrolment
            </div>
            <p className="eyebrow mt-6">Included Project Library</p>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Five Software Workbooks. Five More Systems You Can Build.
            </h2>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">
              The five-day programme gives you the foundation. Your included software workbook library helps you keep practising with complete, practical projects that solve real business problems. All five PDF workbooks are free with a completed enrollment and become available securely in your student dashboard.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {softwareWorkbooks.map((workbook) => (
              <article key={workbook.number} className="surface-raised group flex h-full flex-col overflow-hidden bg-card p-0">
                <div className="relative overflow-hidden border-b border-border bg-muted/30">
                  <Image
                    src={workbook.cover}
                    alt={`${workbook.title} software workbook cover`}
                    width={1130}
                    height={1600}
                    sizes="(min-width: 1280px) 220px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                    className="aspect-[113/160] w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                  />
                  <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-brand-ink/90 px-3 py-1 font-mono text-[0.65rem] font-black uppercase tracking-widest text-sky-300 shadow-lg backdrop-blur">
                    Workbook {workbook.number}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-heading text-lg font-black leading-tight text-foreground">{workbook.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{workbook.description}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="mx-auto mt-20 min-h-[260px] max-w-5xl rounded-3xl border border-white/10 bg-brand-ink p-8 text-white shadow-2xl sm:p-12 lg:mt-28">
            <div className="flex h-full flex-col items-center gap-8 text-center md:flex-row md:text-left">
              <div className="flex-1">
              <p className="eyebrow text-sky-400">Keep building after Day 5</p>
              <h3 className="mt-2 font-heading text-2xl font-black sm:text-3xl">Your learning journey continues beyond the live programme.</h3>
              <p className="mt-4 text-base leading-relaxed text-slate-400">
                Work through the projects at your own pace, strengthen your understanding, and grow a portfolio of useful software you can confidently demonstrate.
              </p>
              </div>
              <div className="shrink-0">
                <Link href={course.checkoutHref} className="btn-primary flex w-full items-center justify-center px-8 py-4 text-base sm:w-auto">
                  Enroll Now <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="student-websites" className="relative scroll-mt-24 overflow-hidden bg-brand-ink py-20 text-white lg:py-32">
        <div className="pointer-events-none absolute left-1/2 top-[30%] z-0 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-600/10 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 z-0 h-[600px] w-[600px] rounded-full bg-primary/5 blur-[100px]" />

        <div className={`${sectionContainer} relative z-10`}>
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <p className="eyebrow inline-flex items-center gap-2 text-sky-400">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
              </span>
              Proof Through Projects
            </p>
            <h2 className="mt-4 font-heading text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Different learners. Different ideas. <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Real projects.</span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-slate-300 sm:text-xl">
              Adults and children learn the same practical building principles, then apply them to ideas that reflect their own goals and interests—from business platforms and portfolio websites to games, learning experiences, and creative digital projects.
            </p>
          </div>

          <div className="mb-9 max-w-3xl">
            <p className="eyebrow text-sky-400">Websites and Digital Tools</p>
            <h3 className="mt-2 font-heading text-2xl font-black tracking-tight text-white sm:text-3xl">
              Built for real needs and real audiences.
            </h3>
            <p className="mt-4 leading-relaxed text-slate-400">
              These live projects show how learners have turned the course foundation into business websites, personal platforms, and practical tools they can share with the world.
            </p>
          </div>

          <div className="grid items-start gap-12 md:grid-cols-3 md:gap-6 lg:gap-10">
            {visibleStudentWebsites.map((site) => (
              <article key={site.url} className="group mx-auto w-full max-w-[350px] text-center">
                <div className="relative mx-auto overflow-hidden rounded-[2.4rem] border-[9px] border-slate-950 bg-slate-950 shadow-2xl shadow-black/30 transition-transform duration-300 group-hover:-translate-y-1">
                  <div className="relative flex h-7 items-center justify-center bg-slate-950" aria-hidden="true">
                    <span className="h-1.5 w-16 rounded-full bg-slate-700" />
                  </div>
                  <div className="relative h-[540px] overflow-hidden rounded-b-[1.75rem] bg-white">
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Loading mobile preview…
                    </div>
                    <iframe
                      src={site.url}
                      title={`Mobile preview of ${site.title}`}
                      className="pointer-events-none relative z-10 h-full w-full border-0 bg-white"
                      loading="lazy"
                      tabIndex={-1}
                      referrerPolicy="no-referrer-when-downgrade"
                      sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts"
                    />
                  </div>
                </div>

                <div className="px-3 pt-6">
                  <span className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-sky-300">
                    Learner Project
                  </span>
                  <h4 className="mt-3 font-heading text-xl font-black text-white">{site.title}</h4>
                  <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{site.displayUrl}</p>
                </div>
              </article>
            ))}
          </div>

          <div id="young-learners" className="mt-24 scroll-mt-24 border-t border-white/10 pt-20 lg:mt-32 lg:pt-24">
            <div className="grid items-end gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
              <div>
                <p className="eyebrow inline-flex items-center gap-2 text-sky-400">
                  <Sparkles className="h-4 w-4" /> Built by Young Learners
                </p>
                <h3 className="mt-3 font-heading text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                  From screen time to building time.
                </h3>
              </div>
              <div className="space-y-4 text-base leading-relaxed text-slate-300 sm:text-lg">
                <p>
                  Young learners can use the same foundation to turn hobbies, stories, school interests, and everyday ideas into live digital projects. No previous coding experience is required.
                </p>
                <p>
                  They learn to explain what they want to create, guide AI, review and improve the result, and publish something real that other people can use.
                </p>
              </div>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "Imagine",
                  description: "Begin with an idea they genuinely care about.",
                  icon: Lightbulb
                },
                {
                  title: "Build and Improve",
                  description: "Guide AI, test the result, and refine the experience.",
                  icon: Code2
                },
                {
                  title: "Publish",
                  description: "Put the project online with a link they can share.",
                  icon: Rocket
                }
              ].map((item) => {
                const Icon = item.icon
                return (
                  <article key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm sm:p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/10 text-sky-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h4 className="mt-4 font-heading text-lg font-black text-white">{item.title}</h4>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.description}</p>
                  </article>
                )
              })}
            </div>

            <div className="mt-14 grid items-start gap-12 md:grid-cols-3 md:gap-6 lg:gap-10">
              {youngLearnerProjects.map((project) => (
                <article key={project.url} className="group mx-auto w-full max-w-[350px] text-center">
                  <div className="relative mx-auto overflow-hidden rounded-[2.4rem] border-[9px] border-slate-950 bg-slate-950 shadow-2xl shadow-black/30 transition-transform duration-300 group-hover:-translate-y-1">
                    <div className="relative flex h-7 items-center justify-center bg-slate-950" aria-hidden="true">
                      <span className="h-1.5 w-16 rounded-full bg-slate-700" />
                    </div>
                    <div className="relative h-[540px] overflow-hidden rounded-b-[1.75rem] bg-white">
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Loading mobile preview…
                      </div>
                      <iframe
                        src={project.url}
                        title={`Mobile preview of ${project.title}`}
                        className="pointer-events-none relative z-10 h-full w-full border-0 bg-white"
                        loading="lazy"
                        tabIndex={-1}
                        referrerPolicy="no-referrer-when-downgrade"
                        sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts"
                      />
                    </div>
                  </div>

                  <div className="px-3 pt-6">
                    <span className="inline-flex rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-violet-300">
                      Young Learner Project
                    </span>
                    <h4 className="mt-3 font-heading text-xl font-black text-white">{project.title}</h4>
                    <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{project.host}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-20 min-h-[260px] max-w-5xl rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-md sm:p-12 lg:mt-28">
            <div className="flex h-full flex-col items-center gap-8 text-center md:flex-row md:text-left">
              <div className="flex-1">
                <p className="eyebrow text-sky-400">The Gallery</p>
                <h3 className="mt-2 font-heading text-2xl font-black tracking-tight text-white sm:text-3xl">
                  Explore more projects from our learners.
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-400">
                  Browse approved websites, web apps, games, and additional projects created by adult, young, and school learners.
                </p>
              </div>
              <div className="shrink-0">
                <Link href="/projects?from=prompt-to-profit" className="btn-primary flex w-full items-center justify-center px-8 py-4 text-base sm:w-auto">
                  View Project Gallery
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-24 lg:mt-32">
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
              Join 800+ learners who have transformed their ideas into live platforms.
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

      <section className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="surface-raised relative overflow-hidden bg-brand-ink p-8 text-white sm:p-12">
              <Award className="mb-6 h-10 w-10 text-sky-400" />
              <h3 className="font-heading text-2xl font-black tracking-tight lg:text-3xl">A Certificate That Demonstrates Ability</h3>
              <div className="mt-6 space-y-4 leading-relaxed text-slate-300">
                <p>Completing lessons alone does not earn a certificate. To receive it, you must successfully complete and submit your project.</p>
                <p>Every certificate includes a verification link connected to the work you built. Employers, schools, and clients can see practical evidence of your achievement.</p>
                <p className="mt-4 font-bold text-white">We believe certificates should represent demonstrated ability rather than simple attendance.</p>
              </div>
            </div>

            <div className="surface-raised bg-card p-8 sm:p-12">
              <CreditCard className="mb-6 h-10 w-10 text-primary" />
              <h3 className="font-heading text-2xl font-black tracking-tight lg:text-3xl">Pay In Installments</h3>
              <div className="mt-6 space-y-4 leading-relaxed text-muted-foreground">
                <p>Investing in your education should not always require paying everything at once.</p>
                <p>Our flexible instalment payment system allows you to spread your payments over time. Once your payment has been completed, your enrolment is automatically activated and you will receive full access.</p>
                <p>Begin planning your learning journey immediately while paying at a pace that works for you.</p>
              </div>
              <Link href={`/dashboard/installments?course=${courseSettings?.courseSlug || "prompt-to-profit"}#start-installment-plan`} className="btn-primary mt-7 px-6 py-3">
                Start an Installment Plan
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid items-center gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="relative">
              <div className="absolute -inset-4 -z-10 -rotate-2 rounded-2xl bg-muted/50" />
              <div className="relative overflow-hidden rounded-xl border border-border bg-brand-ink shadow-xl">
                <Image
                  src="/brand/tochukwu-portrait.webp"
                  alt="Tochukwu Nkwocha"
                  width={640}
                  height={800}
                  className="aspect-[4/5] w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-brand-ink/80 to-transparent" />
              </div>
            </div>

            <div>
              <p className="eyebrow">Meet Your Lead Instructor</p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">About Tochukwu Nkwocha</h2>
              <div className="mt-6 space-y-5 text-lg leading-relaxed text-muted-foreground">
                <p>I build real digital tools for real businesses, but my passion is making complex technology simple enough for ordinary people to understand and use.</p>
                <p>
                  Before AI became widely available, I had already built platforms like Sure Imports and Effiko. Sure Imports has grown to more than <strong className="text-foreground">40,000 users</strong>, while Effiko has recorded over <strong className="text-foreground">10,000 app downloads</strong> and more than <strong className="text-foreground">500,000 yearly Google impressions</strong>.
                </p>
                <p>Today, I build even faster by working alongside AI. Projects such as LineScout and the learning platform that powers this academy were built through practical collaboration with AI.</p>
                <p className="font-bold text-foreground"><TrademarkText text="That is why Prompt to Profit is built around practical experience rather than theory. Everything I teach comes from building real products that solve real problems." /></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CourseAccessibilitySection courseName={<PromptToProfitMark />} />

      <section className="bg-muted/20 py-20 lg:py-28">
        <div className="mx-auto w-full max-w-3xl px-5 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="font-heading text-3xl font-black tracking-tight">Frequently Asked Questions</h2>
          </div>

          <div className="flex flex-col border-t border-border">
            {faqs.map((faq) => (
              <details key={faq.q} className="group border-b border-border [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-4 py-6 font-heading text-lg font-bold text-foreground transition-colors hover:text-primary">
                  <TrademarkText text={faq.q} />
                  <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <div className="pb-8 text-base leading-relaxed text-muted-foreground"><TrademarkText text={faq.a} /></div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="enroll" className="bg-brand-ink py-24 text-center text-white">
        <div className="mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
          <p className="eyebrow mb-6 text-sky-400">New Cohorts Open Every Month</p>
          <h2 className="font-heading text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">Your First Digital Product Starts Here.</h2>
          <div className="mx-auto mt-6 max-w-2xl space-y-4 text-lg leading-relaxed text-slate-300">
            <p>The world does not need more people who simply know how to ask AI questions. It needs people who can use AI to solve real problems.</p>
            <p>If you are ready to stop watching and start building, we would love to welcome you into the next cohort.</p>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link className="btn-inverse max-w-full px-8 py-4 text-center text-base shadow-lg shadow-primary/20" href={course.checkoutHref}>
              Enroll Now.
            </Link>
            <Link className="btn-inverse-secondary max-w-full px-8 py-4 text-center text-base" href="#video">
              <Play className="mr-2 h-4 w-4" /> Learn More
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

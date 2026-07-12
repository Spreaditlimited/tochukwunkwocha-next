import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Users } from "lucide-react"

import { PromptToProfitAdvancedCoursePage } from "@/components/courses/PromptToProfitAdvancedCoursePage"
import { PromptToProfitCoursePage } from "@/components/courses/PromptToProfitCoursePage"
import { PromptToProfitSchoolsCoursePage } from "@/components/courses/PromptToProfitSchoolsCoursePage"
import { JsonLd } from "@/components/JsonLd"
import { TrademarkText } from "@/components/TrademarkText"
import { getCourse, resolveCourseSlug } from "@/lib/public-offers"
import { breadcrumbJsonLd, buildMetadata, courseJsonLd } from "@/lib/site-seo"

type CoursePageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { slug } = await params
  const course = getCourse(resolveCourseSlug(slug))
  return buildMetadata({
    title: course?.title || "Course",
    description: course?.description || "Course detail route scaffolded for migration parity.",
    path: `/courses/${course?.slug || resolveCourseSlug(slug)}`,
    image: course?.logo || undefined
  })
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { slug } = await params
  const canonicalSlug = resolveCourseSlug(slug)

  if (canonicalSlug !== slug) {
    redirect(`/courses/${canonicalSlug}`)
  }

  const course = getCourse(canonicalSlug)
  const pageJsonLd = course
    ? [
        courseJsonLd(course),
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Courses", path: "/courses" },
          { name: course.title, path: course.href }
        ])
      ]
    : null

  if (course?.slug === "prompt-to-profit") {
    return (
      <>
        {pageJsonLd ? <JsonLd data={pageJsonLd} /> : null}
        <PromptToProfitCoursePage course={course} />
      </>
    )
  }

  if (course?.slug === "prompt-to-production") {
    return (
      <>
        {pageJsonLd ? <JsonLd data={pageJsonLd} /> : null}
        <PromptToProfitAdvancedCoursePage course={course} />
      </>
    )
  }

  if (course?.slug === "prompt-to-profit-schools") {
    return (
      <>
        {pageJsonLd ? <JsonLd data={pageJsonLd} /> : null}
        <PromptToProfitSchoolsCoursePage />
      </>
    )
  }

  const displayCourse = course || {
    title: slug.split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" "),
    eyebrow: "Course scaffold",
    description: "Course detail route scaffolded for migration parity.",
    outcome: "Ready to receive migrated enrolment copy, pricing, and server-side checkout flow.",
    href: `/courses/${slug}`,
    checkoutHref: `/checkout/${slug}`,
    legacyHref: "",
    logo: null,
    status: "Route scaffold",
    price: "Pricing confirmed at checkout",
    audience: "Learners",
    duration: "Programme",
    includes: ["Product page route is ready for migrated content."],
    checkoutNotes: ["Checkout route is ready for payment integration."]
  }

  return (
    <main>
      {pageJsonLd ? <JsonLd data={pageJsonLd} /> : null}
      <section className="bg-card">
        <div className="container-page py-12">
          <Link href="/courses" className="inline-flex items-center text-sm font-semibold text-primary no-underline">
            <ArrowLeft className="mr-2 h-4 w-4" /> All courses
          </Link>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="eyebrow">{displayCourse.eyebrow}</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl"><TrademarkText text={displayCourse.title} /></h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{displayCourse.description}</p>
              <div className="mt-6 grid max-w-2xl gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Users className="h-4 w-4 text-primary" />
                    Audience
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{displayCourse.audience}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Clock className="h-4 w-4 text-primary" />
                    Format
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{displayCourse.duration}</p>
                </div>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={displayCourse.checkoutHref} className="btn-primary">
                  Continue to checkout <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link href="/blog" className="btn-secondary">Read related lessons</Link>
              </div>
            </div>
            <aside className="surface-raised bg-brand-ink p-6 text-white">
              {displayCourse.logo ? (
                <Image src={displayCourse.logo} alt={`${displayCourse.title} logo`} width={260} height={80} className="h-12 w-auto object-contain brightness-125" />
              ) : (
                <p className="text-sm font-black uppercase text-brand-sky">{displayCourse.status}</p>
              )}
              <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-black uppercase text-slate-400">Outcome</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">{displayCourse.outcome}</p>
              </div>
              <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-black uppercase text-slate-400">Price</p>
                <p className="mt-2 text-sm font-bold text-white">{displayCourse.price}</p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-brand-sky" />
                {displayCourse.status}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="container-page py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="eyebrow">What is included</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {displayCourse.includes.map((item) => (
                <div key={item} className="flex gap-3 rounded-lg border border-border bg-card p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm font-semibold leading-6">{item}</p>
                </div>
              ))}
            </div>
          </div>
          <aside className="surface-raised h-fit p-5">
            <p className="eyebrow">Enrolment</p>
            <h2 className="mt-2 text-xl font-black tracking-tight">Ready to enrol?</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Course pages now act as product pages. The next step is the checkout page for learner details, payment method, and order summary.
            </p>
            <Link href={displayCourse.checkoutHref} className="btn-primary mt-5 w-full">
              Go to checkout
            </Link>
          </aside>
        </div>
      </section>
    </main>
  )
}

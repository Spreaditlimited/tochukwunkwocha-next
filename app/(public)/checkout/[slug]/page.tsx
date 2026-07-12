import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { CourseCheckoutForm } from "@/components/checkout/CourseCheckoutForm"
import { ServiceCheckoutForm } from "@/components/checkout/ServiceCheckoutForm"
import { getServiceCheckoutDetails, isServiceCheckoutSlug } from "@/lib/payments/service-checkout"
import { getCourse, resolveCourseSlug } from "@/lib/public-offers"
import { buildMetadata } from "@/lib/site-seo"

type CheckoutPageProps = {
  params: Promise<{ slug: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: CheckoutPageProps): Promise<Metadata> {
  const { slug } = await params
  if (isServiceCheckoutSlug(slug)) {
    return buildMetadata({
      title: slug === "build-discovery" ? "Checkout | Build Discovery Call" : "Checkout | Private Coaching Discovery Call",
      description: "Securely complete checkout for your paid discovery call.",
      path: `/checkout/${slug}`,
      noIndex: true
    })
  }
  const course = getCourse(resolveCourseSlug(slug))
  if (!course) return {}

  return {
    ...buildMetadata({
      title: `Checkout | ${course.title}`,
      description: `Securely complete enrolment checkout for ${course.title}.`,
      path: `/checkout/${course.slug}`,
      noIndex: true
    })
  }
}

export default async function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const { slug } = await params
  const query = await searchParams || {}
  const lead = Array.isArray(query.lead) ? query.lead[0] || "" : query.lead || ""

  if (isServiceCheckoutSlug(slug)) {
    const details = await getServiceCheckoutDetails(slug, lead)
    if (!details) notFound()
    return <ServiceCheckoutForm details={details} />
  }

  const canonicalSlug = resolveCourseSlug(slug)

  if (canonicalSlug !== slug) {
    redirect(`/checkout/${canonicalSlug}`)
  }

  const course = getCourse(canonicalSlug)
  if (!course) notFound()

  return <CourseCheckoutForm course={course} />
}

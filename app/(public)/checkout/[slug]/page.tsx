import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { CourseCheckoutForm } from "@/components/checkout/CourseCheckoutForm"
import { getCourse, resolveCourseSlug } from "@/lib/public-offers"
import { buildMetadata } from "@/lib/site-seo"

type CheckoutPageProps = {
  params: Promise<{ slug: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: CheckoutPageProps): Promise<Metadata> {
  const { slug } = await params
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

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { slug } = await params
  const canonicalSlug = resolveCourseSlug(slug)

  if (canonicalSlug !== slug) {
    redirect(`/checkout/${canonicalSlug}`)
  }

  const course = getCourse(canonicalSlug)
  if (!course) notFound()

  return <CourseCheckoutForm course={course} />
}

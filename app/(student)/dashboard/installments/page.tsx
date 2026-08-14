import { InstallmentsPanel } from "@/components/student-dashboard/InstallmentsPanel"
import { StudentDashboardShell } from "@/components/student-dashboard/StudentDashboardShell"
import { listActiveLearningCourseOptions } from "@/lib/student-dashboard"
import { listStudentInstallmentPlans } from "@/lib/student-installments"
import { getStudentProfile, requireStudent } from "@/lib/student-auth"

export const dynamic = "force-dynamic"

export default async function StudentInstallmentsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = searchParams ? await searchParams : {}
  const requestedCourse = Array.isArray(params.course) ? params.course[0] : params.course
  const requestedCoupon = Array.isArray(params.coupon) ? params.coupon[0] : params.coupon
  const initialCourseSlug = String(requestedCourse || "").trim().toLowerCase().slice(0, 120)
  const initialCouponCode = String(requestedCoupon || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40)
  const query = new URLSearchParams()
  if (initialCourseSlug) query.set("course", initialCourseSlug)
  if (initialCouponCode) query.set("coupon", initialCouponCode)
  const returnTo = `/dashboard/installments${query.size ? `?${query.toString()}` : ""}#start-installment-plan`
  const session = await requireStudent(returnTo)
  const profile = await getStudentProfile(session.account.id)
  const courses = await listActiveLearningCourseOptions()
  const plans = await listStudentInstallmentPlans(session.account.id)

  return (
    <StudentDashboardShell
      account={session.account}
      active="installments"
      title="Installments"
      eyebrow="Installment Wallet"
    >
      <InstallmentsPanel
        account={{
          fullName: profile.fullName,
          email: profile.email,
          phone: profile.phone
        }}
        courses={courses}
        initialCourseSlug={initialCourseSlug}
        initialCouponCode={initialCouponCode}
        plans={plans.map((plan) => ({
          ...plan,
          payments: plan.payments.map((payment) => ({
            ...payment,
            paidAt: payment.paidAt ? new Date(payment.paidAt).toISOString() : null,
            createdAt: new Date(payment.createdAt).toISOString()
          }))
        }))}
      />
    </StudentDashboardShell>
  )
}

import { InstallmentsPanel } from "@/components/student-dashboard/InstallmentsPanel"
import { StudentDashboardShell } from "@/components/student-dashboard/StudentDashboardShell"
import { listActiveLearningCourseOptions } from "@/lib/student-dashboard"
import { listStudentInstallmentPlans } from "@/lib/student-installments"
import { getStudentProfile, requireStudent } from "@/lib/student-auth"

export const dynamic = "force-dynamic"

export default async function StudentInstallmentsPage() {
  const session = await requireStudent()
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

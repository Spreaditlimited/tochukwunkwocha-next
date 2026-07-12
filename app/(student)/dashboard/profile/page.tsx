import { ProfileSecurityPanel } from "@/components/student-dashboard/ProfileSecurityPanel"
import { StudentDashboardShell } from "@/components/student-dashboard/StudentDashboardShell"
import { getStudentProfile, listStudentSecurity, requireStudent } from "@/lib/student-auth"

export const dynamic = "force-dynamic"

export default async function StudentProfilePage() {
  const session = await requireStudent()
  const [profile, security] = await Promise.all([
    getStudentProfile(session.account.id),
    listStudentSecurity(session.account.id, session.token)
  ])

  return (
    <StudentDashboardShell 
      account={session.account} 
      active="profile" 
      title="Profile & Security"
      eyebrow="Account Settings"
    >
      <ProfileSecurityPanel
        profile={{
          fullName: profile.fullName,
          email: profile.email,
          phone: profile.phone,
          whatsappOptedIn: profile.whatsappOptedIn,
          certificateNameConfirmedAt: profile.certificateNameConfirmedAt,
          certificateNameUpdatedAt: profile.certificateNameUpdatedAt,
          demographicCountry: profile.demographicCountry,
          demographicRegion: profile.demographicRegion,
          ageBand: profile.ageBand,
          gender: profile.gender,
          learnerCategory: profile.learnerCategory,
          demographicUpdatedAt: profile.demographicUpdatedAt
        }}
        security={{
          sessions: security.sessions.map((item) => ({
            sessionUuid: item.sessionUuid,
            deviceIdHint: item.deviceIdHint,
            userAgent: item.userAgent,
            createdAt: item.createdAt,
            lastSeenAt: item.lastSeenAt,
            expiresAt: item.expiresAt,
            isCurrent: item.isCurrent
          })),
          devices: security.devices.map((item) => ({
            id: Number(item.id),
            deviceIdHint: item.deviceIdHint,
            lastUserAgent: item.lastUserAgent,
            firstSeenAt: item.firstSeenAt,
            lastSeenAt: item.lastSeenAt
          })),
          alerts: security.alerts
        }}
      />
    </StudentDashboardShell>
  )
}

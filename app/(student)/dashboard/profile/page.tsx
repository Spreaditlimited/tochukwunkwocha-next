import { ProfileSecurityPanel } from "@/components/student-dashboard/ProfileSecurityPanel"
import { StudentDashboardShell } from "@/components/student-dashboard/StudentDashboardShell"
import { StudentPublicPortfolioPanel } from "@/components/student-dashboard/StudentPublicPortfolioPanel"
import { getStudentProfile, isManagedGroupLearnerAccount, listStudentSecurity, requireStudent } from "@/lib/student-auth"
import { getStudentPublicPortfolioEditor } from "@/lib/student-public-profile"
import { isPublicAffiliateOnlyAccount } from "@/lib/affiliate-onboarding"

export const dynamic = "force-dynamic"

export default async function StudentProfilePage() {
  const session = await requireStudent()
  const profile = await getStudentProfile(session.account.id)
  const [security, isManagedGroupLearner, publicPortfolio, isAffiliateOnly] = await Promise.all([
    listStudentSecurity(session.account.id, session.token),
    isManagedGroupLearnerAccount(session.account.id),
    getStudentPublicPortfolioEditor(session.account.id),
    isPublicAffiliateOnlyAccount(session.account.id)
  ])

  return (
    <StudentDashboardShell 
      account={session.account} 
      active="profile" 
      title="Profile & Security"
      eyebrow="Account Settings"
      hideAccountEmail={isManagedGroupLearner}
      workspaceMode={isAffiliateOnly ? "affiliate" : "student"}
    >
      <div className="grid gap-8">
      <ProfileSecurityPanel
        isManagedGroupLearner={isManagedGroupLearner}
        affiliateOnly={isAffiliateOnly}
        profile={{
          fullName: profile.fullName,
          email: profile.email,
          profilePictureUrl: profile.profilePictureUrl,
          phone: profile.phone,
          whatsappOptedIn: profile.whatsappOptedIn,
          certificateNameConfirmedAt: profile.certificateNameConfirmedAt,
          certificateNameUpdatedAt: profile.certificateNameUpdatedAt,
          certificateNameLocked: profile.certificateNameLocked,
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
          }))
        }}
      />
      {!isAffiliateOnly ? <StudentPublicPortfolioPanel initialPortfolio={publicPortfolio} /> : null}
      </div>
    </StudentDashboardShell>
  )
}

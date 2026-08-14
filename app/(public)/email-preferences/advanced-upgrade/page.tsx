import Link from "next/link"

import { verifyAdvancedUpgradeUnsubscribeToken } from "@/lib/advanced-upgrade-campaign"

export const dynamic = "force-dynamic"

export default async function AdvancedUpgradeEmailPreferencesPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = searchParams ? await searchParams : {}
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token
  const status = Array.isArray(params.status) ? params.status[0] : params.status
  const email = rawToken ? verifyAdvancedUpgradeUnsubscribeToken(rawToken) : ""

  return (
    <main className="site-container py-20 lg:py-28">
      <section className="surface-raised mx-auto max-w-xl bg-card p-8 text-center sm:p-12">
        <p className="eyebrow text-primary">Email Preferences</p>
        <h1 className="mt-3 font-heading text-3xl font-black tracking-tight">
          {status === "unsubscribed" ? "Campaign emails stopped" : "Stop Advanced course invitations?"}
        </h1>
        {status === "unsubscribed" ? (
          <>
            <p className="mt-5 leading-relaxed text-muted-foreground">
              You will no longer receive the October Advanced upgrade campaign. Your course-access and essential account emails are unaffected.
            </p>
            <Link href="/" className="btn-primary mt-8 px-6 py-3">Return Home</Link>
          </>
        ) : email && rawToken ? (
          <>
            <p className="mt-5 leading-relaxed text-muted-foreground">
              Confirm below to stop the Monday, Wednesday and Friday Prompt to Profit Advanced campaign emails sent to <strong className="text-foreground">{email}</strong>.
            </p>
            <form method="post" action="/api/email-preferences/advanced-upgrade" className="mt-8">
              <input type="hidden" name="token" value={rawToken} />
              <button type="submit" className="btn-primary px-6 py-3">Stop Campaign Emails</button>
            </form>
          </>
        ) : (
          <p className="mt-5 leading-relaxed text-muted-foreground">
            This preference link is invalid or has expired. Contact support@tochukwunkwocha.com if you need help.
          </p>
        )}
      </section>
    </main>
  )
}

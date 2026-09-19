import Link from "next/link"

import { verifyPracticalAiNewsletterUnsubscribeToken } from "@/lib/practical-ai-newsletter"

export const dynamic = "force-dynamic"

export default async function PracticalAiNewsletterPreferencesPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = searchParams ? await searchParams : {}
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token
  const status = Array.isArray(params.status) ? params.status[0] : params.status
  const email = rawToken ? verifyPracticalAiNewsletterUnsubscribeToken(rawToken) : ""

  return (
    <main className="site-container py-20 lg:py-28">
      <section className="surface-raised mx-auto max-w-xl bg-card p-8 text-center sm:p-12">
        <p className="eyebrow text-primary">Email Preferences</p>
        <h1 className="mt-3 font-heading text-3xl font-black tracking-tight">
          {status === "unsubscribed" ? "Weekly practical AI notes stopped" : "Stop weekly practical AI notes?"}
        </h1>
        {status === "unsubscribed" ? (
          <>
            <p className="mt-5 leading-relaxed text-muted-foreground">
              You will no longer receive the 52-week practical AI newsletter. Essential account, purchase and course-access emails are unaffected.
            </p>
            <Link href="/" className="btn-primary mt-8 px-6 py-3">Return Home</Link>
          </>
        ) : email && rawToken ? (
          <>
            <p className="mt-5 leading-relaxed text-muted-foreground">
              Confirm below to stop the weekly practical AI notes sent to <strong className="text-foreground">{email}</strong>.
            </p>
            <form method="post" action="/api/email-preferences/practical-ai-newsletter" className="mt-8">
              <input type="hidden" name="token" value={rawToken} />
              <button type="submit" className="btn-primary px-6 py-3">Stop Weekly Notes</button>
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

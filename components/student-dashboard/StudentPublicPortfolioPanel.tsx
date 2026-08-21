"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import { BriefcaseBusiness, CheckCircle2, Eye, Loader2, ShieldCheck, Sparkles, UserRoundSearch } from "lucide-react"

import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"
import { STUDENT_OPPORTUNITY_TYPES } from "@/lib/student-portfolio-shared"
import type { StudentPublicPortfolioEditor } from "@/lib/student-public-profile"
import { studentSafeErrorMessage } from "@/lib/student-error-feedback"

const SKILL_SUGGESTIONS = [
  "AI-assisted project development",
  "Prompt engineering",
  "Website planning",
  "User interface design",
  "Digital problem solving",
  "Business process automation",
  "Research and content development",
  "Digital product development"
]

function statusText(status: string, hasPublishedVersion: boolean) {
  if (status === "approved") return "Approved and published"
  if (status === "pending") return hasPublishedVersion ? "Changes awaiting review; published version remains live" : "Awaiting administrator review"
  if (status === "rejected") return hasPublishedVersion ? "Changes need attention; published version remains live" : "Changes requested"
  return "Not submitted"
}

export function StudentPublicPortfolioPanel({ initialPortfolio }: { initialPortfolio: StudentPublicPortfolioEditor }) {
  const [portfolio, setPortfolio] = useState(initialPortfolio)
  const [skillsText, setSkillsText] = useState(initialPortfolio.skills.join(", "))
  const [busy, setBusy] = useState(false)

  function update<K extends keyof StudentPublicPortfolioEditor>(key: K, value: StudentPublicPortfolioEditor[K]) {
    setPortfolio((current) => ({ ...current, [key]: value }))
  }

  function toggleOpportunity(value: string) {
    setPortfolio((current) => ({
      ...current,
      opportunityTypes: current.opportunityTypes.includes(value)
        ? current.opportunityTypes.filter((item) => item !== value)
        : [...current.opportunityTypes, value]
    }))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch("/api/student/public-portfolio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...portfolio,
          skills: skillsText.split(",").map((item) => item.trim()).filter(Boolean)
        })
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Could not save your portfolio.")
      setPortfolio(result.portfolio)
      setSkillsText(result.portfolio.skills.join(", "))
      showStudentToast({ type: "success", title: "Portfolio submitted", message: "Your changes are saved and queued for review." })
    } catch (error) {
      showStudentToast({ type: "error", title: "Portfolio not saved", message: studentSafeErrorMessage(error, "Could not save your portfolio.") })
    } finally {
      setBusy(false)
    }
  }

  if (!portfolio.hasVerifiedProject) {
    return (
      <section className="surface-raised overflow-hidden bg-card">
        <div className="flex items-start gap-4 p-6 sm:p-8">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRoundSearch className="h-6 w-6" /></div>
          <div>
            <p className="eyebrow">Public portfolio</p>
            <h2 className="mt-1 font-heading text-xl font-black">Your professional project profile</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">After your first certificate project is approved, you can prepare a moderated public portfolio, add your story and choose whether eligible employers can contact you.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="surface-raised overflow-hidden bg-card">
      <div className="border-b border-border bg-brand-ink p-6 text-white sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300"><Sparkles className="h-6 w-6" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">Public portfolio</p>
              <h2 className="mt-1 font-heading text-2xl font-black">Tell the story behind your work</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">Only approved project facts and the details you consent to publish will appear. Your email, phone number, age, gender and private account details remain hidden.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200">{statusText(portfolio.reviewStatus, portfolio.hasPublishedVersion)}</span>
            {portfolio.hasPublishedVersion ? <Link href={`/projects/${portfolio.publicSlug}`} className="btn-inverse gap-2 px-3 py-1.5 text-xs"><Eye className="h-3.5 w-3.5" /> View public page</Link> : null}
          </div>
        </div>
      </div>

      <form onSubmit={save} className="grid gap-8 p-6 sm:p-8">
        {portfolio.reviewNote ? (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-relaxed text-foreground"><strong>Review note:</strong> {portfolio.reviewNote}</div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <label className="block lg:col-span-2">
            <span className="label mb-2 block">Professional headline</span>
            <input className="field" maxLength={220} value={portfolio.professionalHeadline} onChange={(event) => update("professionalHeadline", event.target.value)} placeholder="AI-assisted website builder focused on practical business solutions" />
            <span className="mt-1 block text-xs text-muted-foreground">A clear description of what you build or the work you want to do.</span>
          </label>
          <label className="block lg:col-span-2">
            <span className="label mb-2 block">Professional introduction</span>
            <textarea className="field min-h-36 resize-y" maxLength={1800} value={portfolio.biography} onChange={(event) => update("biography", event.target.value)} placeholder="Introduce your background, learning journey, interests and the kinds of problems you enjoy solving." />
          </label>
          <label className="block">
            <span className="label mb-2 block">Country shown publicly</span>
            <input className="field" maxLength={120} value={portfolio.country} onChange={(event) => update("country", event.target.value)} placeholder="Nigeria" />
          </label>
          <label className="block">
            <span className="label mb-2 block">Demonstrated skills</span>
            <input className="field" value={skillsText} onChange={(event) => setSkillsText(event.target.value)} placeholder="Prompt engineering, Website planning" />
            <span className="mt-1 block text-xs text-muted-foreground">Separate skills with commas. Add only skills demonstrated by your work.</span>
          </label>
          <div className="lg:col-span-2">
            <p className="label mb-2">Suggested skills</p>
            <div className="flex flex-wrap gap-2">
              {SKILL_SUGGESTIONS.map((skill) => (
                <button key={skill} type="button" className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary/30 hover:text-primary" onClick={() => {
                  const current = skillsText.split(",").map((item) => item.trim()).filter(Boolean)
                  if (!current.includes(skill)) setSkillsText([...current, skill].join(", "))
                }}>{skill}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/15 p-5 sm:p-6">
          <p className="eyebrow">Featured project case study</p>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <label className="block lg:col-span-2"><span className="label mb-2 block">Project overview</span><textarea className="field min-h-28 resize-y" maxLength={1800} value={portfolio.featuredProjectSummary} onChange={(event) => update("featuredProjectSummary", event.target.value)} placeholder="What did you build, who is it for, and what does it help them do?" /></label>
            <label className="block"><span className="label mb-2 block">Problem or challenge</span><textarea className="field min-h-28 resize-y" maxLength={1400} value={portfolio.projectChallenge} onChange={(event) => update("projectChallenge", event.target.value)} placeholder="What need or problem led to the project?" /></label>
            <label className="block"><span className="label mb-2 block">Your solution and contribution</span><textarea className="field min-h-28 resize-y" maxLength={1800} value={portfolio.projectSolution} onChange={(event) => update("projectSolution", event.target.value)} placeholder="Explain what you personally planned, created and improved." /></label>
            <label className="block lg:col-span-2"><span className="label mb-2 block">What you learned</span><textarea className="field min-h-24 resize-y" maxLength={1400} value={portfolio.projectLearning} onChange={(event) => update("projectLearning", event.target.value)} placeholder="What did the project teach you about building, users or problem solving?" /></label>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
          <div className="flex items-start gap-3"><BriefcaseBusiness className="mt-0.5 h-5 w-5 text-primary" /><div><h3 className="font-heading text-lg font-black">Work availability</h3><p className="mt-1 text-sm text-muted-foreground">Hiring enquiries use a protected form. Your contact details are never displayed publicly.</p></div></div>
          {portfolio.hiringEligible ? (
            <div className="mt-5 grid gap-4">
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border p-4">
                <span><span className="block text-sm font-bold">I am open to professional opportunities</span><span className="mt-1 block text-xs text-muted-foreground">This becomes visible only after administrator approval.</span></span>
                <input type="checkbox" className="h-5 w-5 accent-primary" checked={portfolio.openToWork} onChange={(event) => update("openToWork", event.target.checked)} />
              </label>
              {portfolio.openToWork ? <div className="grid gap-2 sm:grid-cols-2">{STUDENT_OPPORTUNITY_TYPES.map((item) => <label key={item.value} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-primary" checked={portfolio.opportunityTypes.includes(item.value)} onChange={() => toggleOpportunity(item.value)} />{item.label}</label>)}</div> : null}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-sky-500/20 bg-sky-500/10 p-4 text-sm leading-relaxed text-foreground">Direct hiring is available only to adult, independently managed learner accounts with an adult age band recorded. Young and managed learners remain protected from direct enquiries.</div>
          )}
        </div>

        <div className="grid gap-3">
          <label className="flex items-start gap-3 rounded-xl border border-border bg-muted/15 p-4"><input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={portfolio.profilePictureConsent} disabled={!portfolio.hasProfilePicture} onChange={(event) => update("profilePictureConsent", event.target.checked)} /><span className="text-sm leading-relaxed"><strong>Publish my profile picture.</strong> {portfolio.hasProfilePicture ? "I understand that my current profile image will be visible on the public website." : "Upload a profile picture above before selecting this option."}</span></label>
          <label className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4"><input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={portfolio.publicProfileConsent} onChange={(event) => update("publicProfileConsent", event.target.checked)} /><span className="text-sm leading-relaxed"><strong>I consent to publication of this portfolio.</strong> I confirm that the information is accurate, appropriate for public viewing and may be reviewed before publication. I can turn off enhanced portfolio publication later.</span></label>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Approved versions remain live while revised content is reviewed.</p>
          <button type="submit" className="btn-primary min-w-44 gap-2" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{busy ? "Saving…" : "Save and submit"}</button>
        </div>
      </form>
    </section>
  )
}

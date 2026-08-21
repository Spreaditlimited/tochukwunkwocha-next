import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowUpRight, BadgeCheck, BriefcaseBusiness, CheckCircle2, ExternalLink, GraduationCap, Lightbulb, MapPin, ShieldCheck, Sparkles, UserRound } from "lucide-react"

import { HireStudentForm } from "@/components/projects/HireStudentForm"
import { cloudinaryTransformUrl, resolveMediaUrl } from "@/lib/cloudinary/url"
import { getPublicStudentPortfolio } from "@/lib/public-student-projects"
import { absoluteUrl, breadcrumbJsonLd, buildMetadata } from "@/lib/site-seo"
import { STUDENT_OPPORTUNITY_TYPES } from "@/lib/student-portfolio-shared"

export const revalidate = 300

type PageProps = { params: Promise<{ slug: string }> }

function firstName(value: string) {
  return value.split(/\s+/).filter(Boolean)[0] || "Student"
}

function formatDate(value: Date | string | null) {
  if (!value) return "Academy reviewed"
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(date) : "Academy reviewed"
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const portfolio = await getPublicStudentPortfolio(slug)
  if (!portfolio) return buildMetadata({ title: "Student Portfolio", description: "Explore verified student work from Tochukwu Tech and AI Academy.", path: `/projects/${slug}`, noIndex: true })
  const description = `${portfolio.learnerLabel} is a ${portfolio.courseLabel} graduate showcasing verified, practical digital project work.`
  return buildMetadata({
    title: `${portfolio.learnerLabel} — Student Portfolio`,
    description,
    path: `/projects/${portfolio.profileSlug}`,
    image: portfolio.profilePictureUrl || undefined,
    imageAlt: portfolio.profilePictureUrl ? `${portfolio.learnerLabel}, ${portfolio.courseLabel} graduate` : undefined,
    noIndex: !portfolio.enhancedProfilePublished
  })
}

export default async function StudentPortfolioPage({ params }: PageProps) {
  const { slug } = await params
  const portfolio = await getPublicStudentPortfolio(slug)
  if (!portfolio) notFound()
  const givenName = firstName(portfolio.learnerLabel)
  const certificateLink = portfolio.links.find((link) => link.kind === "certificate_verification")
  const additionalLinks = portfolio.links.filter((link) => link.kind === "self_declared")
  const opportunityLabels = new Map<string, string>(STUDENT_OPPORTUNITY_TYPES.map((item) => [item.value, item.label]))
  const portrait = portfolio.profilePictureUrl
    ? cloudinaryTransformUrl(resolveMediaUrl(portfolio.profilePictureUrl), { width: 720, height: 840, crop: "fill", quality: "auto", format: "auto" })
    : ""
  const profileJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: portfolio.learnerLabel,
      description: portfolio.professionalHeadline,
      image: portrait || undefined,
      url: absoluteUrl(`/projects/${portfolio.profileSlug}`),
      alumniOf: { "@type": "EducationalOrganization", name: "Tochukwu Tech and AI Academy", url: absoluteUrl("/") },
      knowsAbout: portfolio.skills
    }
  }

  return (
    <main className="bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd([{ name: "Student Projects", path: "/projects" }, { name: portfolio.learnerLabel, path: `/projects/${portfolio.profileSlug}` }])) }} />

      <section className="relative overflow-hidden bg-brand-ink pb-16 pt-12 text-white sm:pb-20 sm:pt-16 lg:pb-24 lg:pt-20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="pointer-events-none absolute right-0 top-0 h-[32rem] w-[32rem] -translate-y-1/3 translate-x-1/3 rounded-full bg-brand-sky/15 blur-[120px]" />
        <div className="site-container relative z-10">
          <Link href="/projects" className="inline-flex items-center gap-2 text-sm font-bold text-slate-300 no-underline transition hover:text-white"><ArrowLeft className="h-4 w-4" /> All student projects</Link>
          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-sky-300"><BadgeCheck className="h-4 w-4" /> Verified student portfolio</span>
                {portfolio.sourceType === "group" ? <span className="rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">Young learner</span> : null}
                {portfolio.openToWork ? <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Open to opportunities</span> : null}
              </div>
              <p className="mt-8 text-sm font-black uppercase tracking-[0.2em] text-sky-300">{portfolio.courseLabel} graduate</p>
              <h1 className="mt-3 max-w-4xl font-heading text-5xl font-black tracking-tighter text-white sm:text-6xl lg:text-7xl">{portfolio.learnerLabel}</h1>
              <p className="mt-5 max-w-3xl text-xl font-semibold leading-relaxed text-slate-200 sm:text-2xl">{portfolio.professionalHeadline}</p>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate-300">
                {portfolio.country ? <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-sky-300" /> {portfolio.country}</span> : null}
                <span className="inline-flex items-center gap-2"><GraduationCap className="h-4 w-4 text-sky-300" /> {formatDate(portfolio.publishedAt)}</span>
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-sky-300" /> Academy reviewed</span>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                {portfolio.openToWork ? <a href="#hire" className="btn-inverse gap-2"><BriefcaseBusiness className="h-4 w-4" /> Hire {givenName}</a> : null}
                <a href={portfolio.projectUrl} target="_blank" rel="noreferrer" className="btn-inverse-secondary gap-2">View live project <ArrowUpRight className="h-4 w-4" /></a>
                {certificateLink ? <Link href={certificateLink.url} className="btn-inverse-secondary gap-2"><BadgeCheck className="h-4 w-4" /> Verify certificate</Link> : null}
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-sm lg:mx-0 lg:justify-self-end">
              <div className="absolute -inset-3 rotate-3 rounded-[2rem] border border-sky-300/20 bg-sky-300/5" />
              <div className="relative aspect-[6/7] overflow-hidden rounded-[1.75rem] border border-white/15 bg-gradient-to-br from-white/10 to-white/5 shadow-2xl">
                {portrait ? <Image src={portrait} alt={`${portfolio.learnerLabel}, ${portfolio.courseLabel} graduate`} fill priority sizes="(max-width: 1024px) 384px, 420px" className="object-cover" /> : <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,hsl(var(--brand-sky)/0.18),transparent_55%)] px-8 text-center"><div className="flex h-28 w-28 items-center justify-center rounded-full border border-white/15 bg-white/10"><UserRound className="h-14 w-14 text-sky-200" /></div><p className="mt-6 font-heading text-4xl font-black text-white">{portfolio.learnerLabel.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</p><p className="mt-2 text-sm text-slate-400">Verified learner profile</p></div>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="site-container grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div>
            <p className="eyebrow">About {givenName}</p>
            <h2 className="mt-2 font-heading text-3xl font-black tracking-tight sm:text-4xl">From learning to a published result</h2>
            <p className="mt-6 max-w-4xl whitespace-pre-line text-lg leading-8 text-muted-foreground">{portfolio.biography}</p>
          </div>
          <aside className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Demonstrated skills</p>
            <div className="mt-4 flex flex-wrap gap-2">{portfolio.skills.map((skill) => <span key={skill} className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-bold text-foreground">{skill}</span>)}</div>
            <p className="mt-5 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">Skills are presented in the context of the learner&apos;s reviewed project work and are not independent professional certifications.</p>
          </aside>
        </div>
      </section>

      <section className="border-y border-border bg-muted/20 py-16 sm:py-24">
        <div className="site-container">
          <div className="max-w-3xl"><p className="eyebrow">Featured case study</p><h2 className="mt-2 font-heading text-3xl font-black tracking-tight sm:text-4xl">A closer look at the project</h2></div>
          <article className="mt-10 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
              <div className="bg-brand-ink p-7 text-white sm:p-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-300/10 text-sky-300"><Sparkles className="h-6 w-6" /></div>
                <p className="mt-8 text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">Live project</p>
                <h3 className="mt-2 break-words font-heading text-3xl font-black">{portfolio.host}</h3>
                <p className="mt-5 text-base leading-7 text-slate-300">{portfolio.featuredProjectSummary}</p>
                <a href={portfolio.projectUrl} target="_blank" rel="noreferrer" className="btn-inverse mt-8 gap-2">Explore the live project <ExternalLink className="h-4 w-4" /></a>
              </div>
              <div className="grid gap-0 sm:grid-cols-2">
                <div className="border-b border-border p-7 sm:border-r sm:p-8"><Lightbulb className="h-5 w-5 text-amber-500" /><h4 className="mt-4 font-heading text-lg font-black">The challenge</h4><p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">{portfolio.projectChallenge || `The project began with the practical challenge of turning an idea into a clear, usable digital experience that could be published and shared with real users.`}</p></div>
                <div className="border-b border-border p-7 sm:p-8"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><h4 className="mt-4 font-heading text-lg font-black">The solution</h4><p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">{portfolio.projectSolution || `${givenName} applied the Academy’s project-based process to plan, create, review and publish a working solution.`}</p></div>
                <div className="p-7 sm:col-span-2 sm:p-8"><GraduationCap className="h-5 w-5 text-primary" /><h4 className="mt-4 font-heading text-lg font-black">Learning and development</h4><p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">{portfolio.projectLearning || `Completing and publishing the project provided practical experience in moving from instruction to independent execution, testing and presentation.`}</p></div>
              </div>
            </div>
          </article>
        </div>
      </section>

      {additionalLinks.length ? <section className="py-16 sm:py-24"><div className="site-container"><p className="eyebrow">More work</p><h2 className="mt-2 font-heading text-3xl font-black">Additional approved projects</h2><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{additionalLinks.map((link) => <article key={link.url} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"><h3 className="font-heading text-xl font-black">{link.label}</h3><p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{link.description || "An additional project submitted by the learner and approved for inclusion in this portfolio."}</p><a href={link.url} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary no-underline">Visit project <ArrowUpRight className="h-4 w-4" /></a></article>)}</div></div></section> : null}

      {portfolio.openToWork ? <section id="hire" className="scroll-mt-24 bg-brand-ink py-16 text-white sm:py-24"><div className="site-container grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-start"><div><span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Open to opportunities</span><h2 className="mt-6 font-heading text-4xl font-black tracking-tight sm:text-5xl">Hire {givenName}</h2><p className="mt-5 text-lg leading-8 text-slate-300">Send a professional project or employment enquiry through the Academy&apos;s protected form. {givenName}&apos;s private email and phone number are never displayed.</p>{portfolio.opportunityTypes.length ? <div className="mt-6 flex flex-wrap gap-2">{portfolio.opportunityTypes.map((type) => <span key={type} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200">{opportunityLabels.get(type) || type}</span>)}</div> : null}<p className="mt-7 text-xs leading-6 text-slate-400">The Academy forwards enquiries but does not verify, guarantee or endorse either party. Both parties should complete their own checks before agreeing to work.</p></div><HireStudentForm studentName={portfolio.learnerLabel} profileSlug={portfolio.profileSlug} opportunityTypes={portfolio.opportunityTypes} /></div></section> : null}

      <section className="border-t border-border py-12"><div className="site-container flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-heading text-xl font-black">Explore more learner-built work</p><p className="mt-1 text-sm text-muted-foreground">Every published project has passed the Academy&apos;s project review process.</p></div><Link href="/projects" className="btn-secondary gap-2">View all student projects <ArrowUpRight className="h-4 w-4" /></Link></div></section>
    </main>
  )
}

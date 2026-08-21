import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { 
  ArrowRight, 
  ArrowUpRight, 
  BadgeCheck,
  Briefcase, 
  ChevronDown,
  Compass, 
  ExternalLink, 
  FolderKanban, 
  GraduationCap, 
  Lightbulb, 
  School, 
  Sparkles,
  Users
} from "lucide-react"

import { listPublicStudentProjects } from "@/lib/public-student-projects"
import { buildMetadata } from "@/lib/site-seo"
import { cloudinaryTransformUrl, resolveMediaUrl } from "@/lib/cloudinary/url"

export const dynamic = "force-dynamic"

export const metadata: Metadata = buildMetadata({
  title: "Student Projects | Tochukwu Tech and AI Academy",
  description: "See what our students have built. Explore approved websites and web apps created by our learners.",
  path: "/projects"
})

function formatDate(value: Date | string | null) {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(date)
}

type StudentProjectsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function StudentProjectsPage({ searchParams }: StudentProjectsPageProps) {
  const params = searchParams ? await searchParams : {}
  const source = Array.isArray(params.from) ? params.from[0] : params.from
  const audience = Array.isArray(params.audience) ? params.audience[0] : params.audience
  const buildYoursHref = source === "prompt-to-profit"
    ? "/checkout/prompt-to-profit"
    : "/courses/prompt-to-profit"
  const publicProjects = await listPublicStudentProjects(90)
  const projects = audience === "young"
    ? publicProjects.filter((project) => project.sourceType !== "individual")
    : publicProjects

  return (
    <main className="bg-background">
      <Link
        href={buildYoursHref}
        className="sticky-project-cta btn-primary fixed bottom-4 right-4 z-20 gap-2 px-5 py-3.5 text-sm shadow-2xl shadow-primary/25 sm:bottom-6 sm:right-6 sm:px-7 sm:py-4 sm:text-base"
        aria-label="Build yours with Prompt to Profit Basic"
      >
        Build Yours
        <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
      </Link>
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-brand-ink pb-12 pt-16 text-white sm:pb-16 sm:pt-24 lg:pt-32">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sky/15 blur-[150px]" />
        <div className="site-container relative z-10">
          <div className="relative grid gap-12 lg:grid-cols-[1fr_minmax(auto,400px)] lg:items-center">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-sky-400">
                <Sparkles className="h-4 w-4" /> Student Projects
              </p>
              <h1 className="mt-6 font-heading text-5xl font-black tracking-tighter text-white sm:text-6xl lg:text-7xl lg:leading-[1.1]">
                See What Our Students Have <span className="bg-gradient-to-r from-brand-sky to-primary bg-clip-text text-transparent">Built.</span>
              </h1>
              <div className="mt-6 space-y-4 text-lg leading-relaxed text-slate-400">
                <p>
                  One of the best ways to understand what&apos;s possible is to see what others have already created.
                </p>
                <p>
                  Every project on this page represents someone who decided to stop wondering whether they could build with AI and started learning by doing. Our students come from different backgrounds. Some had never built a website before joining Prompt to Profit™. Others simply wanted to understand how AI could help them create useful digital solutions.
                </p>
                <p className="font-medium text-white">
                  Today, they have projects they can proudly share with family, employers, clients, and the world.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:gap-6">
              <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl transition-transform hover:-translate-y-1">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-400/10 text-sky-400">
                  <FolderKanban className="h-6 w-6" />
                </div>
                <p className="font-heading text-4xl font-black text-white">{projects.length}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">Published Projects</p>
              </div>
              <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl transition-transform hover:-translate-y-1">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-sky-400">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <p className="font-heading text-4xl font-black text-white">100%</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">Learner Built</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="bg-muted/20 py-16 sm:py-24">
        <div className="site-container">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="font-heading text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              Learning Through Real Projects
            </h2>
            <div className="mt-6 space-y-4 text-lg leading-relaxed text-muted-foreground">
              <p>
                At Tochukwu Tech and AI Academy, we believe confidence comes from building. That is why every programme is designed around practical projects rather than passive learning.
              </p>
              <p>
                Instead of simply watching lessons, learners create websites, software, dashboards, business tools, and other digital solutions while developing practical AI skills. Every completed project represents a new level of understanding.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Gallery Section */}
      <section className="bg-background py-16 sm:py-24">
        <div className="site-container">
          <div className="mb-12 max-w-2xl">
            <h2 className="font-heading text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              Explore Student Projects
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Scroll through the projects below and explore what our learners have built. Click any project to explore it live. Each project reflects the creativity, effort, and progress of the learner who built it.
            </p>
          </div>

          {projects.length ? (
            <div className="grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => {
                const verificationLink = project.links.find((link) => link.kind === "certificate_verification")
                const additionalLinks = project.links.filter((link) => link.kind === "self_declared")
                return (
                <article 
                  key={project.id} 
                  className="group flex h-full flex-col rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
                >
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-4">
                      {project.profileSlug ? (
                        <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-background shadow-sm ${project.sourceType === "group" ? "bg-violet-500/10 text-violet-600 dark:text-violet-400" : "bg-primary/10 text-primary"}`}>
                          <Image src={cloudinaryTransformUrl(resolveMediaUrl(project.profilePictureUrl), { width: 160, height: 160, crop: "fill", quality: "auto", format: "auto" })} alt={`${project.learnerLabel}'s profile picture`} fill sizes="56px" className="object-cover" />
                        </div>
                      ) : (
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${project.sourceType === "school" ? "bg-sky-500/10 text-sky-600 dark:text-sky-400" : project.sourceType === "group" ? "bg-violet-500/10 text-violet-600 dark:text-violet-400" : "bg-primary/10 text-primary"}`}>
                          {project.sourceType === "school" ? <School className="h-6 w-6" /> : project.sourceType === "group" ? <Users className="h-6 w-6" /> : <FolderKanban className="h-6 w-6" />}
                        </div>
                      )}
                      <a
                        href={project.projectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        aria-label={`Open ${project.host}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>

                    <div className="mt-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${project.sourceType === "school" ? "text-sky-600 dark:text-sky-400" : project.sourceType === "group" ? "text-violet-600 dark:text-violet-400" : "text-primary"}`}>
                          {project.courseLabel}
                        </p>
                        {project.sourceType !== "individual" ? (
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${project.sourceType === "school" ? "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400" : "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400"}`}>
                            {project.sourceType === "school" ? "School Learner" : "Young Learner"}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 font-heading text-xl font-black leading-tight tracking-tight text-foreground line-clamp-2">
                        {project.profileSlug ? <Link href={`/projects/${project.profileSlug}`} className="no-underline transition-colors hover:text-primary">{project.learnerLabel}</Link> : project.learnerLabel}
                      </h3>
                      {project.professionalHeadline ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{project.professionalHeadline}</p> : null}
                      {project.openToWork ? <span className="mt-3 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Open to opportunities</span> : null}
                      <p className="mt-3 truncate font-mono text-xs font-medium text-muted-foreground">
                        {project.host}
                      </p>
                    </div>

                    {verificationLink ? (
                      <a
                        href={verificationLink.url}
                        className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm no-underline transition-colors hover:bg-emerald-500/10"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>
                            <span className="block font-bold text-foreground">Verify certificate</span>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">Academy-issued credential</span>
                          </span>
                        </span>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      </a>
                    ) : null}

                    {additionalLinks.length ? (
                      <details className="group/links mt-3 rounded-xl border border-border/60 bg-muted/20">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
                          <span>More links ({additionalLinks.length})</span>
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-open/links:rotate-180" />
                        </summary>
                        <div className="mx-3 mb-3 grid max-h-28 content-start gap-2 overflow-y-auto overscroll-contain border-t border-border/60 pt-3 pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20" aria-label={`Additional links from ${project.learnerLabel}`}>
                          {additionalLinks.map((link) => (
                            <a
                              key={`${project.id}-${link.kind}-${link.url}`}
                              href={link.url}
                              target={link.url.startsWith("/") ? undefined : "_blank"}
                              rel={link.url.startsWith("/") ? undefined : "noreferrer"}
                              className="group/link flex items-start justify-between gap-3 rounded-lg bg-background px-3 py-2 text-xs no-underline transition-colors hover:bg-primary/5"
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-bold text-foreground">{link.label}</span>
                                <span className="mt-0.5 block truncate text-muted-foreground">Additional student project</span>
                              </span>
                              <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 group-hover/link:text-primary" />
                            </a>
                          ))}
                        </div>
                      </details>
                    ) : (
                      <div className="mt-3 flex min-h-11 items-center rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        No other links
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex shrink-0 items-center justify-between gap-4 border-t border-border/50 pt-5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <GraduationCap className="h-4 w-4 opacity-70" />
                      {formatDate(project.publishedAt) || "Approved"}
                    </span>
                    {project.profileSlug ? (
                      <div className="flex items-center gap-3">
                        <Link href={`/projects/${project.profileSlug}`} className="inline-flex items-center gap-1 text-sm font-bold text-primary no-underline">View profile <ArrowRight className="h-4 w-4" /></Link>
                        <a href={project.projectUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground no-underline transition-colors hover:text-primary" aria-label={`Visit ${project.learnerLabel}'s live project`}><ExternalLink className="h-4 w-4" /></a>
                      </div>
                    ) : (
                      <a
                        href={project.projectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-bold text-foreground no-underline transition-colors group-hover:text-primary"
                      >
                        Visit Live
                        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </a>
                    )}
                  </div>
                </article>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-muted/10 py-24 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <FolderKanban className="h-8 w-8" />
              </div>
              <h3 className="mt-6 font-heading text-2xl font-black text-foreground">No public projects yet.</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Approved student projects will appear here after they pass the project review process.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Narrative Bento Grid Section */}
      <section className="bg-muted/20 py-16 sm:py-24">
        <div className="site-container">
          <div className="grid gap-8 md:grid-cols-3">
            
            <article className="flex flex-col rounded-3xl border border-border bg-card p-8 shadow-sm">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Lightbulb className="h-6 w-6" />
              </div>
              <h3 className="font-heading text-xl font-black text-foreground">Every Project Tells a Story</h3>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p>Behind every website and every software application is someone who started with questions.</p>
                <p>Someone who wondered whether AI was too complicated. Someone who believed technology was only for programmers. Someone who decided to try.</p>
                <p>The projects on this page are reminders that practical skills are built one lesson, one improvement, and one completed project at a time.</p>
              </div>
            </article>

            <article className="flex flex-col rounded-3xl border border-border bg-card p-8 shadow-sm">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Briefcase className="h-6 w-6" />
              </div>
              <h3 className="font-heading text-xl font-black text-foreground">More Than a Portfolio</h3>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p>These projects are more than classroom exercises. They become part of each learner&apos;s growing portfolio.</p>
                <p>Students can share them during job applications, client meetings, university admissions, interviews, business presentations, or simply as proof of what they have learned.</p>
                <p>We believe learning should produce something tangible. Building a real project gives learners confidence that watching videos alone never can.</p>
              </div>
            </article>

            <article className="flex flex-col rounded-3xl border border-border bg-card p-8 shadow-sm">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Compass className="h-6 w-6" />
              </div>
              <h3 className="font-heading text-xl font-black text-foreground">Your Project Could Be Next</h3>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p>Every learner featured on this page started somewhere. Many had never built a website before enrolling. Today, they have projects they can proudly share.</p>
                <p>Your journey could begin with your first website. It could continue with software, mobile applications, business systems, automation tools, or something entirely your own.</p>
                <p>The most important step is simply getting started.</p>
              </div>
            </article>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-brand-ink py-24 text-center text-white">
        <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8">
          <h2 className="font-heading text-4xl font-black tracking-tight sm:text-5xl">
            Ready to Build Something You&apos;re Proud Of?
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-slate-300">
            Prompt to Profit™ is designed to help complete beginners move from curiosity to confidence through practical, project-based learning. The next project showcased on this page could be yours.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link className="btn-inverse px-8 py-4 text-base" href="/courses">
              Explore Our Programmes <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link className="btn-inverse-secondary px-8 py-4 text-base" href="/courses/prompt-to-profit">
              Enroll Today
            </Link>
          </div>
        </div>
      </section>

    </main>
  )
}

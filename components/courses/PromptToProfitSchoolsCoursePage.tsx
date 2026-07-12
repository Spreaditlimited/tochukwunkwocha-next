"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, type FormEvent } from "react"
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Quote,
  School,
  Trophy
} from "lucide-react"

function BrowserMockup({ title, url, iframeSrc }: { title: string; url: string; iframeSrc?: string }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-brand-ink shadow-2xl transition-all hover:-translate-y-2 hover:shadow-sky-500/10">
      <div className="flex items-center gap-4 border-b border-white/10 bg-[#161b22] px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-rose-500" />
          <div className="h-3 w-3 rounded-full bg-sky-500" />
          <div className="h-3 w-3 rounded-full bg-emerald-500" />
        </div>
        <div className="flex-1 rounded-md border border-white/5 bg-[#060b14] px-3 py-1 text-center font-mono text-xs text-slate-400">
          {url}
        </div>
      </div>
      <div className="relative aspect-video w-full bg-muted sm:aspect-[4/3] md:aspect-[16/10]">
        {iframeSrc ? (
          <iframe src={iframeSrc} title={title} className="absolute inset-0 h-full w-full border-0 bg-white" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#0a0f1e] text-slate-500">
            <p className="font-mono text-xs font-bold uppercase tracking-widest">[Live Preview Placeholder]</p>
          </div>
        )}
      </div>
    </div>
  )
}

const sectionContainer = "site-container"

const scorecardQuestions = [
  { id: 1, text: "Do your students have access to internet-connected computers or tablets at school?" },
  { id: 2, text: "Does your school leadership actively support introducing practical digital skills?" },
  { id: 3, text: "Are your teachers open to facilitating pre-recorded, guided technical lessons?" }
]

export function PromptToProfitSchoolsCoursePage() {
  const [view, setView] = useState<"landing" | "intro" | "questions" | "lead" | "result">("landing")
  const [currentQ, setCurrentQ] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleStartScorecard = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
    setView("intro")
  }

  const handleExitScorecard = () => {
    setView("landing")
    setCurrentQ(0)
  }

  const handleLeadSubmit = (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      setView("result")
    }, 1500)
  }

  if (view !== "landing") {
    return (
      <main className="relative flex min-h-screen flex-col bg-brand-ink text-white">
        <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="pointer-events-none fixed left-1/2 top-1/2 z-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/10 blur-[150px]" />

        <header className="relative z-20 flex w-full items-center justify-between px-6 py-6 lg:px-8">
          <h4 className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-widest text-sky-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
            Readiness Scorecard
          </h4>
          <button onClick={handleExitScorecard} className="text-xs font-bold uppercase tracking-widest text-slate-400 transition-colors hover:text-white">
            Cancel & Exit
          </button>
        </header>

        <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
          <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a1120]/80 p-8 shadow-2xl backdrop-blur-2xl sm:p-12">
            {view === "intro" && (
              <div className="animate-in fade-in zoom-in-95 text-center duration-500">
                <h2 className="font-heading text-4xl font-black tracking-tight sm:text-5xl">Let's check your readiness.</h2>
                <p className="mx-auto mt-6 max-w-lg text-lg text-slate-400">
                  Answer a few quick questions to see if your school can successfully roll out the program in the next 30 days.
                </p>
                <div className="mt-10">
                  <button onClick={() => setView("questions")} className="btn-primary px-10 py-5 text-lg shadow-lg shadow-primary/20">
                    Begin Scorecard <ArrowRight className="ml-2 h-5 w-5" />
                  </button>
                </div>
              </div>
            )}

            {view === "questions" && (
              <div className="animate-in slide-in-from-right-8 duration-500">
                <div className="mb-8 flex items-center justify-between">
                  <p className="font-mono text-sm font-bold uppercase tracking-widest text-slate-500">
                    Question {currentQ + 1} of {scorecardQuestions.length}
                  </p>
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full bg-gradient-to-r from-sky-500 to-cyan-500 transition-all duration-500" style={{ width: `${((currentQ + 1) / scorecardQuestions.length) * 100}%` }} />
                  </div>
                </div>
                <h3 className="font-heading text-3xl font-black leading-tight sm:text-4xl">
                  {scorecardQuestions[currentQ]?.text}
                </h3>
                <div className="mt-10 grid gap-4">
                  {["Yes, absolutely", "Somewhat / Working on it", "No, not currently"].map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        if (currentQ < scorecardQuestions.length - 1) setCurrentQ((current) => current + 1)
                        else setView("lead")
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-6 text-left text-lg font-bold text-slate-300 transition-all hover:-translate-y-1 hover:border-sky-500/50 hover:bg-sky-500/10 hover:text-white hover:shadow-lg"
                    >
                      {option} <ChevronRight className="h-5 w-5 text-sky-500" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {view === "lead" && (
              <div className="animate-in slide-in-from-right-8 text-center duration-500">
                <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">You're done! Let's get your results.</h2>
                <p className="mx-auto mt-4 max-w-lg text-slate-400">Enter your details below to instantly view your score and recommended next steps.</p>

                <form onSubmit={handleLeadSubmit} className="mt-10 grid gap-6 text-left">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Full Name</span>
                      <input required className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-4 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500" placeholder="e.g. Mary Johnson" />
                    </label>
                    <label className="block">
                      <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">School Name</span>
                      <input required className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-4 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500" placeholder="e.g. Sunrise Secondary" />
                    </label>
                    <label className="block">
                      <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Work Email</span>
                      <input type="email" required className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-4 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500" placeholder="name@school.edu" />
                    </label>
                    <label className="block">
                      <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Your Role</span>
                      <input required className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-4 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500" placeholder="Principal / ICT Coordinator" />
                    </label>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="btn-primary mt-4 w-full px-8 py-5 text-lg shadow-lg shadow-primary/20 disabled:opacity-50">
                    {isSubmitting ? "Calculating..." : "Show My Results"}
                  </button>
                </form>
              </div>
            )}

            {view === "result" && (
              <div className="animate-in zoom-in-95 text-center duration-500">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-sky-500/20 bg-sky-500/10 shadow-[0_0_30px_rgba(14,165,233,0.3)]">
                  <Trophy className="h-10 w-10 text-sky-500" />
                </div>
                <p className="font-mono text-lg font-bold uppercase tracking-widest text-sky-500">Score: 85/100</p>
                <h2 className="mt-4 font-heading text-4xl font-black tracking-tight">Highly Ready for Implementation</h2>
                <p className="mx-auto mt-6 max-w-lg text-lg text-slate-400">
                  Your school possesses the infrastructure and leadership mindset required to successfully roll out practical AI education.
                </p>

                <div className="mx-auto mt-10 max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-left">
                  <p className="font-heading text-xl font-bold text-white">Recommended Next Step:</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">Book an onboarding call with our team to discuss integration timelines and dashboard setup for your teachers.</p>
                  <Link href="/schools/book-call" className="btn-inverse mt-6 w-full px-6 py-4 text-sm">
                    Book Onboarding Call
                  </Link>
                </div>

                <div className="mt-10">
                  <button onClick={handleExitScorecard} className="text-xs font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-white">
                    Back to Homepage
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main>
      <section className="relative overflow-hidden bg-brand-ink pt-16 text-white lg:pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/15 blur-[150px]" />

        <div className={`${sectionContainer} relative z-10 pb-20 text-center lg:pb-32`}>
          <div className="mx-auto max-w-4xl">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-sky-500">
              <School className="h-4 w-4" /> B2B Educational Rollout
            </p>

            <h1 className="font-heading text-5xl font-black tracking-tighter sm:text-6xl lg:text-[5rem] lg:leading-[1.05]">
              Is your school ready for <span className="bg-gradient-to-r from-sky-300 to-cyan-500 bg-clip-text text-transparent">practical AI?</span>
            </h1>

            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              Find out in 3 minutes. Take the readiness scorecard to see if your school has what it takes to roll out real-world AI learning in the next 30 days.
            </p>

            <div className="mx-auto mt-10 flex max-w-xl flex-col items-center justify-center gap-4 sm:flex-row">
              <button onClick={handleStartScorecard} className="btn-primary w-full px-8 py-4 text-base shadow-lg shadow-primary/20 sm:w-auto">
                Start Scorecard
              </button>
              <Link className="btn-secondary w-full px-8 py-4 text-base sm:w-auto" href="/schools/book-call">
                Book a Call
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mb-16 text-center">
            <p className="eyebrow text-sky-500">Parent Feedback</p>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              What parents are seeing
            </h2>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="surface-raised relative bg-card p-8 sm:p-10">
              <Quote className="absolute right-8 top-8 h-16 w-16 text-muted-foreground/10" />
              <div className="mb-6 flex items-center gap-4">
                <Image
                  src="/testimonials/anuri-avatar.webp"
                  alt="Anuri Okongwu"
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div>
                  <p className="font-heading font-bold text-foreground">Anuri Okongwu</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest text-sky-500">Secondary School Parent</p>
                </div>
              </div>
              <p className="text-base leading-relaxed text-muted-foreground">
                “Thanks to your training, they built their websites in just a few days without any prior knowledge of HTML and CSS, and they are already live. Honestly, I got great value for the money spent, which is why I am confident about continuing.”
              </p>
            </div>

            <div className="surface-raised relative bg-card p-8 sm:p-10">
              <Quote className="absolute right-8 top-8 h-16 w-16 text-muted-foreground/10" />
              <div className="mb-6 flex items-center gap-4">
                <Image
                  src="/testimonials/marquis-avatar.webp"
                  alt="Marquis Festus"
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div>
                  <p className="font-heading font-bold text-foreground">Marquis Festus</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest text-sky-500">Father of an 8-year old</p>
                </div>
              </div>
              <p className="text-base leading-relaxed text-muted-foreground">
                “She followed along and by the end, she had a live page for a business she made up. The proof that a course works is not in the certificate. It is in what the student builds when the class ends.”
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-brand-ink py-20 text-white lg:py-28">
        <div className={sectionContainer}>
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <p className="eyebrow text-sky-500">Proof of Concept</p>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Real Student Output
            </h2>
            <p className="mt-6 text-lg text-slate-300">
              Built by young students following the workflow. They learn to command AI to build real websites and simple web games step by step.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <BrowserMockup title="The Man Cave Naija" url="themancavenaija.com" iframeSrc="https://themancavenaija.com/" />
            <BrowserMockup title="Kachi Game Arcade" url="kachigamearcade.netlify.app" iframeSrc="https://kachigamearcade.netlify.app" />
          </div>
        </div>
      </section>

      <section className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="eyebrow text-sky-500">The Pedagogy</p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
                Built for practical outcomes, not abstract tech talk.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                The program combines guided lessons, simple implementation, and clear student output. Schools can launch without creating extra teaching pressure, and students can produce publishable work early.
              </p>

              <ul className="mt-8 space-y-5">
                {[
                  { title: "Real learning model", desc: "Students follow clear prompts and build real web pages." },
                  { title: "Structured delivery", desc: "Pre-recorded lessons make rollout simpler for school teams." },
                  { title: "Beginner friendly", desc: "No prior coding background required before starting." },
                  { title: "School-ready operations", desc: "Onboarding and student access handled through a simple dashboard." }
                ].map((item) => (
                  <li key={item.title} className="flex items-start gap-4">
                    <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-sky-500" />
                    <div>
                      <strong className="text-foreground">{item.title}: </strong>
                      <span className="text-muted-foreground">{item.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-6">
              <div className="surface-raised border-l-4 border-l-sky-500 bg-card p-8">
                <p className="font-heading text-5xl font-black text-foreground">350+</p>
                <p className="mt-2 font-medium text-muted-foreground">Learners trained in the first 2 months after launch.</p>
              </div>
              <div className="surface-raised border-l-4 border-l-cyan-500 bg-card p-8">
                <p className="font-heading text-4xl font-black text-foreground">Zero Pressure</p>
                <p className="mt-2 font-medium text-muted-foreground">No heavy tech expertise required from your teaching staff.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <p className="eyebrow text-sky-500">How We Do It</p>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
              A one-week plan made for young creators.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">We move fast, but we keep everything simple and fun.</p>
          </div>

          <div className="relative mx-auto max-w-4xl space-y-8 before:absolute before:inset-0 before:ml-[34px] before:h-full before:w-0.5 before:-translate-x-px before:bg-gradient-to-b before:from-sky-500/50 before:via-cyan-500/20 before:to-transparent md:before:mx-auto md:before:translate-x-0">
            {[
              { day: 1, title: "Getting over the fear of AI", desc: "We kick things off together. Your child will learn what AI can do, how to give clear instructions, and we will build fun games." },
              { day: 2, title: "The absolute basics of websites", desc: "They will learn the building blocks of websites in a super simple way. Then we use AI to help them build their first simple webpage." },
              { day: 3, title: "Building their first real project", desc: "Now ideas become real projects. They will use AI to build a useful webpage around something they love." },
              { day: 4, title: "Making it look great and going live", desc: "We add colors, improve layout, and make their page look amazing on phone and laptop. Then we publish it online." },
              { day: 5, title: "Fixing mistakes and building what’s next", desc: "We fix any bugs, celebrate what they built, and show them the next exciting things they can create with AI." }
            ].map((item) => (
              <div key={item.day} className="group relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-background bg-sky-500/10 font-heading text-xl font-black text-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.2)] md:order-1 md:group-even:translate-x-1/2 md:group-odd:-translate-x-1/2">
                  {item.day}
                </div>
                <div className="surface-raised w-[calc(100%-5rem)] bg-card p-6 transition-transform hover:-translate-y-1 md:w-[calc(50%-3rem)] md:p-8">
                  <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-sky-500">Day {item.day}</p>
                  <h3 className="font-heading text-xl font-bold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-brand-ink py-24 text-center text-white">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[800px] -translate-x-1/2 -translate-y-1/2 bg-sky-500/20 blur-[150px]" />
        <div className="relative z-10 mx-auto max-w-3xl px-5 sm:px-6 lg:px-8">
          <h2 className="font-heading text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Ready to see where your school stands?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
            Built for school owners, principals, and ICT decision makers who want practical results without the operational headache.
          </p>
          <div className="mx-auto mt-10 flex max-w-xl flex-col items-center justify-center gap-4 sm:flex-row">
            <button onClick={handleStartScorecard} className="btn-primary w-full px-8 py-4 text-base shadow-lg shadow-primary/20 sm:w-auto">
              Start Scorecard
            </button>
            <Link className="btn-secondary w-full px-8 py-4 text-base sm:w-auto" href="/schools/book-call">
              Book a Call Instead
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

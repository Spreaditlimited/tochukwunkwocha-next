import Link from "next/link"
import { ArrowRight, BookOpen, GraduationCap, Home, Search } from "lucide-react"

import { Footer } from "@/components/Footer"
import { SiteHeader } from "@/components/SiteHeader"

const helpfulLinks = [
  {
    href: "/blog",
    title: "Read the latest articles",
    description: "Find published AI, learning, and digital-building articles.",
    icon: BookOpen
  },
  {
    href: "/resources",
    title: "Explore resources",
    description: "Browse prompts and videos for practical AI use.",
    icon: Search
  },
  {
    href: "/courses",
    title: "View programmes",
    description: "See available courses and enrollment options.",
    icon: GraduationCap
  }
]

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="relative overflow-hidden bg-background">
        <section className="relative py-20 sm:py-24 lg:py-32">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:28px_28px]" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />

          <div className="site-container relative z-10">
            <div className="mx-auto max-w-3xl text-center">
              <p className="eyebrow text-primary">Page Not Found</p>
              <h1 className="mt-4 font-heading text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                This page is not available.
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                The page may have moved, the link may be old, or the article may not be published yet. Use one of the links below to continue.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/" className="btn-primary justify-center px-8 py-4 text-base">
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Link>
                <Link href="/blog" className="btn-secondary justify-center px-8 py-4 text-base">
                  Visit Blog
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-3">
              {helpfulLinks.map(({ href, title, description, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="group rounded-lg border border-border bg-card p-6 no-underline shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-5 font-heading text-lg font-black text-foreground">{title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
                  <span className="mt-5 inline-flex items-center text-sm font-bold text-primary">
                    Open
                    <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

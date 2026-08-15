import Image from "next/image"
import Link from "next/link"
import { ArrowRight, BriefcaseBusiness } from "lucide-react"

import { primaryBlogAuthor } from "@/lib/blog-author"

export function BlogAuthorByline() {
  return (
    <Link
      href={primaryBlogAuthor.profilePath}
      className="group inline-flex items-center gap-2 text-foreground transition-colors hover:text-primary"
      rel="author"
    >
      <Image
        src={primaryBlogAuthor.portrait}
        alt={primaryBlogAuthor.portraitAlt}
        width={32}
        height={32}
        className="h-8 w-8 rounded-full border border-border object-cover object-top shadow-sm"
      />
      <span>{primaryBlogAuthor.name}</span>
    </Link>
  )
}

export function BlogAuthorCard() {
  return (
    <aside
      aria-labelledby="about-article-author"
      className="mt-16 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="grid gap-0 sm:grid-cols-[180px_1fr]">
        <div className="relative min-h-64 bg-brand-ink sm:min-h-full">
          <Image
            src={primaryBlogAuthor.portrait}
            alt={primaryBlogAuthor.portraitAlt}
            fill
            sizes="(min-width: 640px) 180px, 100vw"
            className="object-cover object-top"
          />
        </div>

        <div className="p-6 sm:p-8">
          <p className="eyebrow">About the author</p>
          <h2 id="about-article-author" className="mt-2 font-heading text-2xl font-black tracking-tight text-foreground">
            {primaryBlogAuthor.name}
          </h2>
          <p className="mt-2 flex items-center gap-2 text-sm font-bold text-primary">
            <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
            {primaryBlogAuthor.role}
          </p>
          <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
            {primaryBlogAuthor.fullBio}
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm font-bold">
            <Link
              href={primaryBlogAuthor.profilePath}
              rel="author"
              className="inline-flex items-center text-primary transition-colors hover:text-foreground"
            >
              Read full profile <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href={primaryBlogAuthor.sureImportsUrl}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Visit Sure Imports
            </a>
          </div>
        </div>
      </div>
    </aside>
  )
}

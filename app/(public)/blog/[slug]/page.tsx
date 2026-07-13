import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, Calendar, Download, FileText, User } from "lucide-react"

import { JsonLd } from "@/components/JsonLd"
import { getBlogImageSrc, getContinueReadingPosts, getPostBySlug, parseBlogSeo } from "@/lib/blog"
import { formatDate } from "@/lib/utils"
import { brand } from "@/lib/brand"
import { normalizeLeadMagnetDownloadUrl } from "@/lib/marketing"
import { articleJsonLd, breadcrumbJsonLd, buildMetadata } from "@/lib/site-seo"

interface BlogPostPageProps {
  params: Promise<{ slug: string }>
}

export const dynamic = "force-dynamic"

const sectionContainer = "site-container"

function leadMagnetBullets(value: string | null | undefined) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 4)
      : []
  } catch (_error) {
    return []
  }
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) return {}
  
  const seo = parseBlogSeo(post)
  const imageSrc = getBlogImageSrc(post.blogImage)
  
  return buildMetadata({
    title: seo.metaTitle || seo.seoTitle || post.blogTitle,
    description: seo.metaDescription || post.excerpt || brand.description,
    path: `/blog/${post.blogSlug}`,
    image: imageSrc,
    type: "article"
  })
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) notFound()

  const seo = parseBlogSeo(post)
  const leadMagnet = post.leadMagnet?.status === "active" ? post.leadMagnet : null
  const leadMagnetPdfUrl = leadMagnet?.pdfUrl ? normalizeLeadMagnetDownloadUrl(leadMagnet.pdfUrl) : ""
  const leadMagnetBenefits = leadMagnetBullets(leadMagnet?.bulletsJson)
  const imageSrc = getBlogImageSrc(post.blogImage)
  const continueReadingPosts = await getContinueReadingPosts(post, 3)

  return (
    <main className="bg-background pb-24">
      <JsonLd
        data={[
          articleJsonLd(post, imageSrc),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: post.blogTitle, path: `/blog/${post.blogSlug}` }
          ])
        ]}
      />
      {/* 1. Article Header & Meta */}
      <header className="relative overflow-hidden pt-12 lg:pt-20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        <div className={`${sectionContainer} relative z-10 pb-12`}>
          <div className="mx-auto max-w-4xl text-center">
            <Link 
              href="/blog" 
              className="group mb-8 inline-flex items-center text-sm font-bold text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" /> 
              Back to Publications
            </Link>
            
            <h1 className="font-heading text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl lg:leading-[1.1]">
              {post.blogTitle}
            </h1>
            
            {post.excerpt && (
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                {post.excerpt}
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 border-t border-border pt-8 text-sm font-semibold text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                {formatDate(post.createdAt)}
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                {post.blogBy || brand.personalName}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Featured Image */}
      {imageSrc && (
        <div className={`${sectionContainer} -mt-8 relative z-20 mb-16`}>
          <div className="relative mx-auto aspect-video max-w-5xl overflow-hidden rounded-xl border border-border bg-card shadow-lg sm:aspect-[21/9]">
            <Image
              src={imageSrc} 
              alt={`Cover image for ${post.blogTitle}`} 
              fill
              sizes="(min-width: 1280px) 1024px, 100vw"
              className="object-cover"
              priority
            />
          </div>
        </div>
      )}

      {/* 3. Reading Container */}
      <article className="mx-auto w-full max-w-3xl px-5 sm:px-6 lg:px-8">
        
        {/* Lead Magnet (Elevated Premium Callout) */}
        {leadMagnet && (
          <aside data-blog-lead-cta data-lead-magnet-slug={leadMagnet.slug} className="surface-raised mb-12 flex flex-col justify-between overflow-hidden bg-brand-ink text-white sm:flex-row sm:items-center">
            <div className="p-6 sm:p-8">
              <p className="eyebrow text-sky-400">Academy Resource</p>
              <h2 className="mt-2 font-heading text-xl font-black tracking-tight sm:text-2xl">
                {leadMagnet.offerHeadline || leadMagnet.title}
              </h2>
              {leadMagnet.description && (
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  {leadMagnet.description}
                </p>
              )}
              {leadMagnetBenefits.length ? (
                <ul className="mt-4 grid gap-2 text-sm text-slate-300">
                  {leadMagnetBenefits.map((benefit) => (
                    <li key={benefit} className="flex gap-2 leading-relaxed">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300" aria-hidden="true" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {leadMagnetPdfUrl && (
              <div className="border-t border-white/10 bg-white/5 p-6 sm:border-l sm:border-t-0 sm:p-8 flex items-center justify-center shrink-0">
                <button
                  type="button"
                  data-lead-magnet-open
                  data-lead-magnet-slug={leadMagnet.slug}
                  className="btn-inverse w-full px-6 py-3 text-sm sm:w-auto"
                >
                  <Download className="mr-2 h-4 w-4" /> 
                  {leadMagnet.buttonText || "Download"}
                </button>
              </div>
            )}
          </aside>
        )}

        {leadMagnet ? (
          <script
            id="tnBlogLeadMagnetConfig"
            type="application/json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                mode: "blog_lead_magnet",
                blogSlug: post.blogSlug,
                blogTitle: post.blogTitle,
                leadMagnet: {
                  slug: leadMagnet.slug,
                  title: leadMagnet.title,
                  offerHeadline: leadMagnet.offerHeadline,
                  description: leadMagnet.description,
                  buttonText: leadMagnet.buttonText,
                  bullets: leadMagnetBenefits,
                  pdfUrl: leadMagnetPdfUrl
                }
              }).replace(/</g, "\\u003c")
            }}
          />
        ) : null}

        {/* Dynamic Content */}
        {/* The 'blog-content' class from globals.css will style the nested tags automatically */}
        <div
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: post.blogContent || "" }}
        />

        {continueReadingPosts.length ? (
          <section className="mt-16 pt-10">
            <div className="mb-6">
              <p className="eyebrow">Continue reading</p>
              <h2 className="mt-2 font-heading text-2xl font-black tracking-tight text-foreground">
                Related lessons for this topic
              </h2>
            </div>

            <div className="grid gap-5">
              {continueReadingPosts.map((relatedPost) => {
                const relatedImageSrc = getBlogImageSrc(relatedPost.blogImage)
                return (
                  <Link
                    key={relatedPost.pidBlog}
                    href={`/blog/${relatedPost.blogSlug}`}
                    className="group grid gap-4 rounded-lg border border-border bg-card p-4 no-underline transition-colors hover:border-primary/40 hover:bg-muted/30 sm:grid-cols-[160px_1fr]"
                  >
                    {relatedImageSrc ? (
                      <div className="relative aspect-[16/10] overflow-hidden rounded-md border border-border bg-muted">
                        <Image
                          src={relatedImageSrc}
                          alt={`Cover image for ${relatedPost.blogTitle}`}
                          fill
                          sizes="(min-width: 640px) 160px, 100vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    ) : null}
                    <div className={relatedImageSrc ? "" : "sm:col-span-2"}>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {formatDate(relatedPost.createdAt)}
                      </p>
                      <h3 className="mt-2 font-heading text-lg font-black leading-snug text-foreground group-hover:text-primary">
                        {relatedPost.blogTitle}
                      </h3>
                      {relatedPost.excerpt ? (
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                          {relatedPost.excerpt}
                        </p>
                      ) : null}
                      <span className="mt-4 inline-flex items-center text-sm font-bold text-primary">
                        Read next <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ) : null}

        {/* Footer Meta */}
        <footer className="mt-16 pt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link 
              href="/blog" 
              className="group inline-flex items-center text-sm font-bold text-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" /> 
              Back to Publications
            </Link>
            
            {seo.focusKeyword && (
              <div className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Topic: {seo.focusKeyword}
              </div>
            )}
          </div>
        </footer>
      </article>
    </main>
  )
}

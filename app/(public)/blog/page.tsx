import Link from "next/link"
import { 
  ArrowRight, 
  BookOpen, 
  Briefcase, 
  Cpu, 
  FolderGit2, 
  GraduationCap, 
  Mail, 
  MessageSquare, 
  Terminal, 
  TrendingUp 
} from "lucide-react"

import { BlogNewsletterForm } from "@/components/blog/BlogNewsletterForm"
import { getBlogImageSrc, getPublishedPostsPage } from "@/lib/blog"
import { buildMetadata } from "@/lib/site-seo"
import { formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

export const metadata = buildMetadata({
  title: "AI, Technology, and Building Insights",
  description: "Practical articles on AI, prompt engineering, software building, productivity, business, education, and digital skills.",
  path: "/blog"
})

const sectionContainer = "site-container"
const BLOG_PAGE_SIZE = 12

function pageHref(page: number) {
  return page <= 1 ? "/blog" : `/blog?page=${page}`
}

function normalizePage(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value
  const page = Number(raw || 1)
  return Number.isFinite(page) ? Math.max(1, Math.round(page)) : 1
}

export default async function BlogPage({
  searchParams
}: {
  searchParams?: Promise<{ page?: string | string[] }>
}) {
  const params = searchParams ? await searchParams : {}
  const requestedPage = normalizePage(params.page)
  const { posts, total, page, totalPages } = await getPublishedPostsPage({ page: requestedPage, pageSize: BLOG_PAGE_SIZE })
  const featuredPost = posts.length > 0 ? posts[0] : null
  const gridPosts = posts.length > 1 ? posts.slice(1) : []
  const currentPage = Math.min(page, totalPages)
  const paginationPages = Array.from(
    new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages].filter((item) => item >= 1 && item <= totalPages))
  )

  const topics = [
    { title: "Artificial Intelligence", icon: Cpu, desc: "Understand AI without unnecessary technical language. Learn how AI works, where it is being used, and how you can apply it in everyday life." },
    { title: "Prompt Engineering", icon: MessageSquare, desc: "Learn how to communicate more effectively with AI systems through structured prompting, practical examples, and real-world applications." },
    { title: "Software Development", icon: Terminal, desc: "Discover how modern software is designed and built using AI-assisted workflows, even if you have no previous programming experience." },
    { title: "Business & Productivity", icon: Briefcase, desc: "Explore practical ways businesses, entrepreneurs, and professionals are using AI to improve efficiency and solve everyday challenges." },
    { title: "Education", icon: GraduationCap, desc: "Read about AI literacy, digital education, learning strategies, and preparing children and adults for a technology-driven future." },
    { title: "Career Development", icon: TrendingUp, desc: "Understand how AI is changing the workplace and discover practical skills that can help you remain relevant in a rapidly evolving world." },
    { title: "Student Projects", icon: FolderGit2, desc: "See what learners are building, how they approached their projects, the challenges they solved, and the lessons they learned." }
  ]

  const series = [
    "Getting Started with Artificial Intelligence",
    "Building Software with AI",
    "AI for Business",
    "AI for Schools",
    "AI for Parents",
    "Prompt Engineering Fundamentals",
    "Practical Technology Guides"
  ]

  return (
    <main>
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-background pt-16 lg:pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        <div className={`${sectionContainer} relative z-10 pb-16 lg:pb-24`}>
          <div className="mx-auto max-w-4xl text-center">
            <p className="eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-primary">
              <BookOpen className="h-4 w-4" />
              Academy Insights
            </p>
            <h1 className="font-heading text-5xl font-black tracking-tighter text-foreground sm:text-6xl lg:text-7xl lg:leading-[1.1]">
              Practical Insights on AI, Technology, and <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-sky-500">Building.</span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Artificial Intelligence is moving quickly, but understanding it shouldn’t feel overwhelming. Explore clear explanations written for real people—whether you are discovering AI for the first time or looking for practical ways to improve your business.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Latest Articles (Featured + Grid) */}
      <section className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mb-12">
            <p className="eyebrow">The Publication</p>
            <h2 className="mt-2 font-heading text-3xl font-black tracking-tight">Explore Our Latest Articles</h2>
            {total > 0 ? (
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                Showing page {currentPage} of {totalPages} across {total} published articles.
              </p>
            ) : null}
          </div>
          
          {posts.length > 0 ? (
            <div className="grid gap-8">
              {/* Featured Post (Full Width) */}
              {featuredPost && (
                <Link href={`/blog/${featuredPost.blogSlug}`} className="group surface-raised grid overflow-hidden bg-card transition-shadow hover:shadow-lg lg:grid-cols-2">
                  {getBlogImageSrc(featuredPost.blogImage) ? (
                    <div className="relative aspect-video w-full overflow-hidden lg:aspect-auto">
                      <img
                        src={getBlogImageSrc(featuredPost.blogImage) || ""}
                        alt={featuredPost.blogTitle}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-col justify-center p-8 sm:p-12">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">{formatDate(featuredPost.createdAt)}</p>
                    <h3 className="mt-4 font-heading text-2xl font-black leading-snug text-foreground transition-colors group-hover:text-primary lg:text-3xl">
                      {featuredPost.blogTitle}
                    </h3>
                    <p className="mt-4 line-clamp-3 text-base leading-relaxed text-muted-foreground">
                      {featuredPost.excerpt}
                    </p>
                    <p className="mt-8 inline-flex items-center text-sm font-bold text-foreground">
                      Read Featured Article <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </p>
                  </div>
                </Link>
              )}

              {/* Grid Posts */}
              {gridPosts.length > 0 && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {gridPosts.map((post) => (
                    <Link key={post.pidBlog} href={`/blog/${post.blogSlug}`} className="group surface-raised flex flex-col overflow-hidden bg-card no-underline transition-all hover:border-primary/50 hover:shadow-md">
                      {getBlogImageSrc(post.blogImage) ? (
                        <div className="aspect-[16/10] overflow-hidden">
                          <img
                            src={getBlogImageSrc(post.blogImage) || ""}
                            alt={post.blogTitle}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        </div>
                      ) : null}
                      <div className="flex flex-1 flex-col justify-between p-6">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-primary">{formatDate(post.createdAt)}</p>
                          <h3 className="mt-4 font-heading text-xl font-bold leading-snug text-foreground transition-colors group-hover:text-primary">{post.blogTitle}</h3>
                          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
                        </div>
                        <p className="mt-6 inline-flex items-center text-sm font-bold text-foreground">
                          Read Article <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {totalPages > 1 ? (
                <nav className="flex flex-col items-center justify-between gap-4 pt-4 sm:flex-row" aria-label="Blog pagination">
                  <Link
                    href={pageHref(currentPage - 1)}
                    aria-disabled={currentPage <= 1}
                    className={`btn-secondary px-5 py-3 text-sm ${currentPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    Previous
                  </Link>
                  <div className="flex flex-wrap justify-center gap-2">
                    {paginationPages.map((item, index) => {
                      const previous = paginationPages[index - 1]
                      return (
                        <span key={item} className="inline-flex items-center gap-2">
                          {previous && item - previous > 1 ? <span className="px-1 text-sm font-bold text-muted-foreground">...</span> : null}
                          <Link
                            href={pageHref(item)}
                            aria-current={item === currentPage ? "page" : undefined}
                            className={`inline-flex h-10 min-w-10 items-center justify-center rounded-md border px-3 text-sm font-black transition ${
                              item === currentPage
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
                            }`}
                          >
                            {item}
                          </Link>
                        </span>
                      )
                    })}
                  </div>
                  <Link
                    href={pageHref(currentPage + 1)}
                    aria-disabled={currentPage >= totalPages}
                    className={`btn-secondary px-5 py-3 text-sm ${currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
                  >
                    Next
                  </Link>
                </nav>
              ) : null}
            </div>
          ) : (
            <div className="surface-raised flex flex-col items-center justify-center bg-card p-16 text-center">
              <BookOpen className="mb-4 h-10 w-10 text-muted-foreground/50" />
              <p className="font-heading text-xl font-bold">No publications found.</p>
              <p className="mt-2 text-muted-foreground">Check back soon for new insights and practical guides.</p>
            </div>
          )}
        </div>
      </section>

      {/* 3. Written for Complete Beginners (Immersive Dark Section) */}
      <section className="bg-brand-ink py-20 text-white lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="eyebrow text-sky-400">Our Approach</p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight lg:text-4xl">Written for Complete Beginners.</h2>
              <div className="mt-6 space-y-4 text-lg leading-relaxed text-slate-300">
                <p>Many technology articles assume readers already understand complex terminology. We take a different approach.</p>
                <p>Every article is written with clarity in mind. We explain ideas using simple language, practical examples, and real-world situations so that anyone can follow along, regardless of their background.</p>
                <p className="font-bold text-white">Our goal is not simply to share information. It is to help readers develop understanding they can apply with confidence.</p>
              </div>
            </div>
            
            <div className="border-t border-white/10 pt-12 lg:border-l lg:border-t-0 lg:pl-16 lg:pt-0">
              <p className="eyebrow text-sky-400">Continuous Education</p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight lg:text-4xl">Learn Beyond the Classroom.</h2>
              <div className="mt-6 space-y-4 text-lg leading-relaxed text-slate-300">
                <p>The learning journey doesn’t end after completing a course. Our blog helps learners stay informed, deepen their understanding, and continue developing practical knowledge long after finishing a programme.</p>
                <p>Whether you’re enrolled in one of our courses or simply curious about Artificial Intelligence, you’ll always find something useful to explore.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Topics We Cover (Bento Grid) */}
      <section className="py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mb-12 max-w-3xl">
            <p className="eyebrow">Subject Matter</p>
            <h2 className="mt-2 font-heading text-3xl font-black tracking-tight">Topics We Cover</h2>
            <p className="mt-4 text-lg text-muted-foreground">Our writers regularly publish articles across a growing range of practical subjects.</p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic, i) => {
              const Icon = topic.icon
              return (
                <div key={i} className="surface-raised flex flex-col justify-between bg-card p-6 transition-shadow hover:shadow-md">
                  <div>
                    <div className="mb-5 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-heading text-xl font-bold">{topic.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{topic.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 5. Featured Series & Newsletter Split */}
      <section className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            
            {/* Featured Series */}
            <div className="surface-raised bg-card p-8 sm:p-12">
              <p className="eyebrow">Deep Dives</p>
              <h2 className="mt-2 font-heading text-3xl font-black tracking-tight">Featured Series</h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Some subjects deserve more than a single article. Our blog includes in-depth series that explore important topics over multiple publications, allowing readers to build understanding gradually.
              </p>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                {series.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm font-semibold text-foreground">
                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Newsletter */}
            <div className="surface-raised flex flex-col justify-center bg-brand-ink p-8 text-white sm:p-12">
              <Mail className="mb-6 h-10 w-10 text-sky-400" />
              <h2 className="font-heading text-3xl font-black tracking-tight">Never Miss a New Article</h2>
              <p className="mt-4 text-base leading-relaxed text-slate-300">
                We publish new articles regularly to help learners keep pace with developments in Artificial Intelligence and digital technology. Subscribe to receive resources delivered directly to your inbox.
              </p>
              
              <BlogNewsletterForm />
              <p className="mt-4 text-xs text-slate-500">We respect your privacy. Unsubscribe at any time.</p>
            </div>

          </div>
        </div>
      </section>

      {/* 6. Final CTA */}
      <section className="py-24 text-center">
        <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8">
          <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
            Continue Learning
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Looking for something more structured? Explore our programmes for guided, project-based learning, or visit our Resources section for free videos and templates. Whether you prefer reading, watching, or building, there is always another step in your learning journey.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link className="btn-primary px-8 py-3.5 text-base" href="/courses">
              Explore Programmes
            </Link>
            <Link className="btn-secondary px-8 py-3.5 text-base" href="/resources">
              Browse Resources
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

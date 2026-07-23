import Link from "next/link"
import Image from "next/image"
import { 
  ArrowRight, 
  Award, 
  Blocks,
  BookOpen, 
  Briefcase,
  Code2,
  Globe2,
  Layout, 
  School,
  Target,
  Terminal,
  Users
} from "lucide-react"

import { PublicVideoSlotPlayer } from "@/components/PublicVideoSlotPlayer"
import { PromptToProfitMark } from "@/components/TrademarkText"
import { brand } from "@/lib/brand"
import { getBlogImageSrc, getPublishedPosts } from "@/lib/blog"
import { getPublicVideoSlot } from "@/lib/public-video-slots"
import { buildMetadata } from "@/lib/site-seo"
import { formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

export const metadata = buildMetadata({
  title: "Practical AI Education for People Who Want to Build",
  description: brand.description,
  path: "/"
})

const sectionContainer = "site-container"

export default async function HomePage() {
  const [posts, introductionVideo] = await Promise.all([
    getPublishedPosts(3),
    getPublicVideoSlot("home-introduction")
  ])

  const buildProjects = [
    "Business websites", "Personal portfolio websites", "Inventory management systems",
    "Expense trackers", "Invoice generators", "School management tools",
    "AI-powered productivity workflows", "Interactive calculators", "Landing pages",
    "Business automation tools", "Custom software for everyday tasks"
  ]

  const learnerAudiences = [
    "Children", "Parents", "Students", "Professionals", "Entrepreneurs",
    "Business owners", "Teachers", "Schools", "Career changers", "Lifelong learners"
  ]

  return (
    <main>
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-background pt-16 lg:pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        <div className={`${sectionContainer} relative z-10 pb-16 lg:pb-24`}>
          <div className="mx-auto max-w-4xl text-center">
            <p className="eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
              </span>
              Enrolling Globally
            </p>
            <h1 className="font-heading text-5xl font-black tracking-tighter text-foreground sm:text-6xl lg:text-7xl lg:leading-[1.1]">
              Practical AI Education for People Who <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-sky-500">Want to Build</span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Artificial Intelligence is changing how we learn, work, solve problems, and build businesses. We help complete beginners, students, professionals, parents, entrepreneurs, and schools develop practical AI skills by building real projects.
            </p>
            
            <div className="mx-auto mt-10 flex max-w-xl flex-col items-center justify-center gap-4 sm:flex-row">
              <Link className="btn-primary w-full px-8 py-4 text-base shadow-lg shadow-primary/20 sm:w-auto" href="/courses">
                Explore Programmes
              </Link>
              <Link className="btn-secondary w-full px-8 py-4 text-base sm:w-auto" href="/resources">
                Browse Free Resources
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Global Social Proof */}
      <section className="bg-brand-ink py-12 text-white">
        <div className={sectionContainer}>
          <div className="grid items-center gap-8 md:grid-cols-[1fr_2fr] lg:gap-12">
            <div>
              <div className="flex items-center gap-3 text-sky-400 mb-2">
                <Globe2 className="h-6 w-6" />
                <span className="font-heading text-xl font-bold">Trusted Globally</span>
              </div>
              <p className="text-3xl font-black">400+ Learners</p>
            </div>
            <div className="border-l border-white/10 pl-6 md:pl-8 text-slate-300">
              <p className="text-base leading-relaxed">
                Joined by learners from <strong className="text-white">Nigeria, the United Kingdom, the United States, and Canada</strong>. Our students do far more than watch lessons. They build websites, software, business tools, and AI workflows that demonstrate real understanding.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Introduction Video */}
      <section className="py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 items-center">
            <div>
              <p className="eyebrow">Welcome to the Academy</p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
                Artificial Intelligence is one of the most important technologies of our time.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                Many people still believe it is too technical or too complicated to learn. In this short video, our Founder and Lead Instructor explains why the academy exists, how our programmes are different, what learners build, and how anyone can benefit from practical AI education.
              </p>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 rounded-2xl bg-muted/50 -z-10 transform rotate-2"></div>
              <PublicVideoSlotPlayer
                slot={introductionVideo}
                className="aspect-video w-full rounded-2xl bg-brand-ink text-white shadow-xl hover:scale-[1.02] transition-transform cursor-pointer" 
                emptyMessage="Configure the home introduction video from the internal Video Library."
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Why We Exist & Philosophy Grid */}
      <section className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            
            {/* Why We Exist */}
            <div className="surface-raised bg-card p-8 sm:p-10">
              <div className="mb-6 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="font-heading text-2xl font-black tracking-tight">Why We Exist</h3>
              <p className="mt-4 font-bold text-foreground">Technology should create opportunities, not barriers.</p>
              <div className="mt-4 space-y-4 text-muted-foreground leading-relaxed">
                <p>Too many people believe AI is only for programmers. Others spend countless hours watching videos without ever building anything themselves. We started {brand.shortName} to change that.</p>
                <p>Our goal is simple: make practical AI education accessible to anyone willing to learn. Whether you are eight years old or eighty, everyone deserves the opportunity to understand and benefit from this technology.</p>
              </div>
            </div>

            {/* Learn By Building */}
            <div className="surface-raised bg-brand-ink p-8 text-white sm:p-10">
              <div className="mb-6 inline-flex rounded-lg bg-white/10 p-3 text-sky-400">
                <Blocks className="h-6 w-6" />
              </div>
              <h3 className="font-heading text-2xl font-black tracking-tight">Learn by Building</h3>
              <p className="mt-4 font-bold text-slate-200">Learning becomes meaningful when knowledge is applied.</p>
              <p className="mt-4 text-slate-400 leading-relaxed">
                Throughout our programmes, learners build practical projects that reflect real-world needs and everyday business challenges. 
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                {buildProjects.slice(0, 8).map((project, i) => (
                  <span key={i} className="inline-flex rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
                    {project}
                  </span>
                ))}
                <span className="inline-flex rounded-md px-3 py-1.5 text-xs font-bold text-sky-400">+ More</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Our Programmes */}
      <section className="py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mb-16 max-w-3xl">
            <p className="eyebrow">Our Programmes</p>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
              Clear learning pathways for individuals, businesses, and schools.
            </h2>
          </div>
          
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Prompt to Profit Basic */}
            <div className="surface-raised flex flex-col justify-between p-8 sm:p-10">
              <div>
                <Code2 className="mb-6 h-8 w-8 text-primary" />
                <h3 className="font-heading text-2xl font-black tracking-tight"><PromptToProfitMark suffix=" Basic" /></h3>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  Our flagship beginner programme introduces learners to AI through practical projects. No previous programming experience required. Build real digital solutions from the very beginning.
                </p>
              </div>
              <Link href="/courses/prompt-to-profit" className="mt-10 btn-primary w-fit">
                Explore Programme
              </Link>
            </div>

            {/* Prompt to Profit Advanced */}
            <div className="surface-raised flex flex-col justify-between bg-brand-ink p-8 text-white sm:p-10">
              <div>
                <Terminal className="mb-6 h-8 w-8 text-sky-400" />
                <h3 className="font-heading text-2xl font-black tracking-tight"><PromptToProfitMark suffix=" Advanced" /></h3>
                <p className="mt-4 text-base leading-relaxed text-slate-300">
                  Designed for learners who want to build larger, more sophisticated applications. Work with databases, authentication, deployment, and advanced AI-assisted software development techniques.
                </p>
              </div>
              <Link href="/courses/prompt-to-production" className="mt-10 inline-flex items-center font-bold text-sky-400 hover:text-sky-300">
                Explore Programme <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>

            {/* Schools Programme */}
            <div className="surface-raised flex flex-col justify-between bg-muted/40 p-8 sm:p-10 border-primary/20">
              <div>
                <School className="mb-6 h-8 w-8 text-primary" />
                <h3 className="font-heading text-2xl font-black tracking-tight">Schools Programme</h3>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  A complete AI learning platform designed specifically for schools. Administrators manage enrolment and monitor progress. Students access learning securely using unique access codes.
                </p>
              </div>
              <Link href="/courses/prompt-to-profit-schools" className="mt-10 btn-secondary w-fit border-primary/30">
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Built for Every Learner & Certificates */}
      <section className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            
            {/* Built for every learner */}
            <div>
              <p className="eyebrow">Inclusive Education</p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight">Built for Every Learner</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                Whether you are exploring AI for the first time or looking to solve complex business challenges, our teaching approach remains practical, supportive, and project-based.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {learnerAudiences.map((audience, i) => (
                  <span key={i} className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm">
                    {audience}
                  </span>
                ))}
              </div>
            </div>

            {/* Certificates */}
            <div className="surface-raised relative overflow-hidden bg-brand-ink p-8 text-white sm:p-10">
              <div className="absolute -right-10 -top-10 text-white/5">
                <Award className="h-64 w-64" />
              </div>
              <div className="relative z-10">
                <Award className="mb-6 h-10 w-10 text-sky-400" />
                <h3 className="font-heading text-2xl font-black tracking-tight">What Makes Our Certificates Different</h3>
                <div className="mt-4 space-y-4 text-slate-300 leading-relaxed">
                  <p>Completing lessons is only part of learning. At {brand.shortName}, certificates are awarded only after learners successfully complete and submit practical projects.</p>
                  <p>Every certificate includes a verification link connected to a real project built by the learner, allowing employers, schools, and clients to see practical evidence of the skills demonstrated.</p>
                  <p className="font-bold text-white">We believe certificates should reflect ability, not simply course completion.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 7. Services: Build With AI & Coaching */}
      <section className="py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mb-16 text-center max-w-3xl mx-auto">
            <p className="eyebrow">Professional Services</p>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
              Done for you, or done with you.
            </h2>
          </div>
          
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Build With AI */}
            <div className="surface-raised p-8 sm:p-10">
              <Layout className="mb-6 h-10 w-10 text-primary" />
              <h3 className="font-heading text-2xl font-black tracking-tight">Build With AI</h3>
              <p className="mt-2 text-sm font-bold text-muted-foreground uppercase tracking-widest">Get Your Project Built</p>
              <div className="mt-6 space-y-4 text-muted-foreground leading-relaxed">
                <p>Some people already have a project in mind and need an experienced builder to help bring it to life. Through our Build service, clients can hire the Academy to build practical AI-assisted digital projects.</p>
                <p>Personally handled by the Academy’s Lead Instructor, this service is suitable for entrepreneurs and organisations that want to build websites, internal tools, automation workflows, or custom software solutions.</p>
              </div>
              <Link href="/build" className="mt-10 btn-primary">Start a Build Project</Link>
            </div>

            {/* Personal Coaching */}
            <div className="surface-raised p-8 sm:p-10">
              <Users className="mb-6 h-10 w-10 text-primary" />
              <h3 className="font-heading text-2xl font-black tracking-tight">Personal Coaching</h3>
              <p className="mt-2 text-sm font-bold text-muted-foreground uppercase tracking-widest">1-on-1 Guidance</p>
              <div className="mt-6 space-y-4 text-muted-foreground leading-relaxed">
                <p>Some projects require closer guidance. Our one-to-one coaching programme is designed for entrepreneurs, founders, and teams who want personalised support while building their own software.</p>
                <p>Coaching sessions focus on practical progress, helping participants solve technical challenges and move confidently from ideas to working products.</p>
              </div>
              <Link href="/private-ai-build-coaching" className="mt-10 btn-secondary">Learn About Coaching</Link>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Latest Articles */}
      <section className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mb-12 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <p className="eyebrow">Latest Articles</p>
              <h2 className="mt-2 font-heading text-3xl font-black tracking-tight">Read the Blog</h2>
              <p className="mt-4 text-muted-foreground">Our blog explores the practical side of AI, education, business, and digital skills. Clear, accessible language that prioritises understanding over technical jargon.</p>
            </div>
            <Link href="/blog" className="btn-secondary whitespace-nowrap">
              Browse All Articles
            </Link>
          </div>
          
          <div className="grid gap-6 md:grid-cols-3">
            {posts.length ? (
              posts.map((post) => {
                const imageSrc = getBlogImageSrc(post.blogImage)
                return (
                <Link key={post.pidBlog} href={`/blog/${post.blogSlug}`} className="group surface-raised flex flex-col overflow-hidden bg-card no-underline transition-all hover:border-primary/50 hover:shadow-md">
                  {imageSrc ? (
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={imageSrc}
                        alt={post.blogTitle}
                        fill
                        sizes="(min-width: 768px) 33vw, 100vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
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
                )
              })
            ) : (
              <div className="surface-raised bg-card flex flex-col items-center justify-center p-12 text-center md:col-span-3">
                <BookOpen className="mb-4 h-8 w-8 text-muted-foreground/50" />
                <p className="font-heading text-lg font-bold">No published posts found.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 9. Pre-footer Grid: Resources, Projects, About */}
      <section className="py-20">
        <div className={sectionContainer}>
          <div className="grid gap-8 lg:grid-cols-3">
            
            <div className="rounded-2xl border border-border bg-card p-8 text-center transition-shadow hover:shadow-md">
              <BookOpen className="mx-auto mb-5 h-8 w-8 text-primary" />
              <h3 className="font-heading text-xl font-bold">Free Resources</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Explore our growing collection of free educational resources, videos, and guides to help you understand AI one step at a time.</p>
              <Link href="/resources" className="mt-6 inline-flex font-bold text-primary hover:underline">Explore Resources</Link>
            </div>

            <div className="rounded-2xl border border-border bg-card p-8 text-center transition-shadow hover:shadow-md">
              <Briefcase className="mx-auto mb-5 h-8 w-8 text-primary" />
              <h3 className="font-heading text-xl font-bold">Student Projects</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">See what others have built. Explore websites, software, and practical applications created by learners through our programmes.</p>
              <Link href="/projects" className="mt-6 inline-flex font-bold text-primary hover:underline">View Student Projects</Link>
            </div>

            <div className="rounded-2xl border border-border bg-card p-8 text-center transition-shadow hover:shadow-md">
              <Globe2 className="mx-auto mb-5 h-8 w-8 text-primary" />
              <h3 className="font-heading text-xl font-bold">About the Academy</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">We believe AI should help people create, solve problems, and improve everyday life. Learn more about our mission and teaching philosophy.</p>
              <Link href="/about" className="mt-6 inline-flex font-bold text-primary hover:underline">Learn More</Link>
            </div>

          </div>
        </div>
      </section>

      {/* 10. Final CTA */}
      <section className="bg-brand-ink py-24 text-center text-white">
        <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8">
          <h2 className="font-heading text-4xl font-black tracking-tight sm:text-5xl">
            Your journey into practical AI starts here.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-slate-300">
            Whether exploring AI for the first time, building software for your business, or introducing AI education in your school, we are here to help you learn by building.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link className="btn-inverse px-8 py-4 text-base" href="/courses">
              Explore Programmes <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link className="btn-inverse-secondary px-8 py-4 text-base" href="/resources">
              Browse Resources
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

import Link from "next/link"
import Image from "next/image"
import { 
  ArrowRight, 
  Award,
  Blocks,
  BookOpen,
  Code2, 
  Compass,
  Eye, 
  FileText,
  Globe2,
  LayoutDashboard, 
  Rocket, 
  School,
  ShieldCheck, 
  Target, 
  Terminal,
  Users 
} from "lucide-react"

import { PublicVideoSlotPlayer } from "@/components/PublicVideoSlotPlayer"
import { brand } from "@/lib/brand"
import { getPublicVideoSlot } from "@/lib/public-video-slots"
import { buildMetadata } from "@/lib/site-seo"

export const dynamic = "force-dynamic"

export const metadata = buildMetadata({
  title: "About Tochukwu Tech and AI Academy",
  description: "Learn about Tochukwu Tech and AI Academy, our founder-led approach, and our practical AI education ecosystem.",
  path: "/about"
})

const sectionContainer = "mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8"

export default async function AboutPage() {
  const academyStoryVideo = await getPublicVideoSlot("about-academy-story")
  const audiences = [
    "Complete beginners", "Children and teenagers", "Parents", 
    "University students", "Professionals", "Entrepreneurs", 
    "Business owners", "Teachers", "Schools", 
    "Organisations", "Career changers", "Lifelong learners"
  ]

  const ecosystemItems = [
    { text: "Prompt to Profit™ Basic", icon: Code2 },
    { text: "Prompt to Profit™ Advanced", icon: Terminal },
    { text: "AI Education for Schools", icon: School },
    { text: "Monthly Build Services", icon: LayoutDashboard },
    { text: "One-to-One AI Project Coaching", icon: Users },
    { text: "Free Learning Resources", icon: BookOpen },
    { text: "Practical Articles and Guides", icon: FileText },
    { text: "Project-Based Certification", icon: Award },
    { text: "Ongoing Learning Opportunities", icon: Globe2 }
  ]

  return (
    <main>
      {/* 1. Hero Section (Immersive Dark) */}
      <section className="relative overflow-hidden bg-brand-ink pt-16 text-white lg:pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        <div className="absolute right-0 top-0 -translate-y-1/3 translate-x-1/3 h-[600px] w-[600px] rounded-full bg-sky-500/20 blur-[150px] pointer-events-none"></div>

        <div className={`${sectionContainer} relative z-10 pb-20 lg:pb-28`}>
          <div className="max-w-4xl">
            <p className="eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1.5 text-sky-400">
              <ShieldCheck className="h-4 w-4" />
              About the Academy
            </p>
            <h1 className="font-heading text-5xl font-black tracking-tighter sm:text-6xl lg:text-7xl lg:leading-[1.1]">
              Helping People Build with <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-primary">Artificial Intelligence.</span>
            </h1>
            <p className="mt-8 text-xl font-medium text-slate-300">
              Artificial Intelligence is changing how people learn, work, solve problems, and create opportunities. 
            </p>
            <div className="mt-6 space-y-4 text-lg leading-relaxed text-slate-400">
              <p>
                At {brand.name}, we believe everyone should have the opportunity to understand and use this technology, regardless of their background or previous experience.
              </p>
              <p>
                Our academy exists to make practical AI education simple, accessible, and useful. Rather than teaching technology through endless theory, we teach by building. Every programme is designed to help learners develop practical skills through real projects that reflect the kinds of digital tools businesses, schools, and organisations use every day.
              </p>
              <p className="font-bold text-white">
                Whether you are a complete beginner, a student, a professional, a parent, an entrepreneur, or a school introducing AI education, our goal is the same: to help you develop the confidence to build with AI.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Our Story (Video Section) */}
      <section className="bg-background py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 items-center">
            <div>
              <p className="eyebrow">The Origin</p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
                Every academy has a story.
              </h2>
              <div className="mt-6 space-y-4 text-lg leading-relaxed text-muted-foreground">
                <p>
                  In this short video, our Founder and Lead Instructor shares why {brand.shortName} was created, why practical AI education matters, how our teaching philosophy developed, and the vision that continues to guide everything we do.
                </p>
                <p>
                  You'll discover why we believe building is the best way to learn, why we focus on complete beginners, and why we are committed to helping ordinary people develop extraordinary digital skills through Artificial Intelligence.
                </p>
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute -inset-4 rounded-xl bg-muted/50 -z-10 transform rotate-1"></div>
              <PublicVideoSlotPlayer
                slot={academyStoryVideo}
                className="aspect-video w-full rounded-lg bg-brand-ink text-white shadow-xl cursor-pointer border border-border" 
                emptyMessage="Configure the academy story video from the internal Video Library."
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Mission & Vision (Bento Split) */}
      <section className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-8 lg:grid-cols-2">
            
            <div className="surface-raised flex flex-col justify-between bg-card p-8 sm:p-12">
              <div>
                <Target className="mb-6 h-10 w-10 text-primary" />
                <p className="eyebrow mb-2">Our Mission</p>
                <h3 className="font-heading text-2xl font-black tracking-tight lg:text-3xl">Accessible, Practical Education.</h3>
                <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                  To make practical Artificial Intelligence education accessible to everyone by helping learners build real digital solutions that prepare them for the opportunities of today and tomorrow.
                </p>
              </div>
            </div>

            <div className="surface-raised flex flex-col justify-between bg-brand-ink text-white p-8 sm:p-12">
              <div>
                <Eye className="mb-6 h-10 w-10 text-sky-400" />
                <p className="eyebrow text-sky-400 mb-2">Our Vision</p>
                <h3 className="font-heading text-2xl font-black tracking-tight text-white lg:text-3xl">Empowering Millions.</h3>
                <p className="mt-6 text-lg leading-relaxed text-slate-300">
                  To become one of the world's leading institutions for beginner-friendly AI education, empowering millions of people with practical digital skills that improve lives, strengthen businesses, and expand opportunities.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. Teaching Philosophy (4-Card Grid) */}
      <section className="bg-background py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mb-16 text-center max-w-3xl mx-auto">
            <p className="eyebrow">Methodology</p>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
              Our Teaching Philosophy
            </h2>
            <p className="mt-6 text-lg text-muted-foreground">
              We believe people learn best by building. Watching videos can introduce ideas, but confidence comes from creating something with your own hands.
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2">
            
            <div className="surface-raised bg-card p-8 sm:p-10">
              <div className="mb-6 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                <Blocks className="h-6 w-6" />
              </div>
              <h3 className="font-heading text-2xl font-black">Building is at the Centre</h3>
              <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground">
                <p>Every programme includes practical projects because we believe understanding grows through application.</p>
                <p>Our learners build websites, business tools, dashboards, software applications, mobile applications, and automation workflows that demonstrate real progress.</p>
                <p className="font-bold text-foreground">Our role is to help learners think clearly, solve problems, and build confidently with AI.</p>
              </div>
            </div>

            <div className="surface-raised bg-card p-8 sm:p-10">
              <div className="mb-6 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                <Compass className="h-6 w-6" />
              </div>
              <h3 className="font-heading text-2xl font-black">Practical Before Technical</h3>
              <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground">
                <p>Many people believe Artificial Intelligence is only for programmers. We disagree.</p>
                <p>While technology can become highly sophisticated, learning should not begin with unnecessary complexity.</p>
                <p>We focus on helping learners understand how digital systems work using simple language and practical examples, without overwhelming them with technical jargon.</p>
              </div>
            </div>

            <div className="surface-raised bg-card p-8 sm:p-10 lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
              <div>
                <div className="mb-6 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                  <Rocket className="h-6 w-6" />
                </div>
                <h3 className="font-heading text-2xl font-black">Skills That Outlast Today's AI Tools</h3>
                <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground">
                  <p>Artificial Intelligence is evolving rapidly. New platforms appear every month. Existing tools improve constantly.</p>
                  <p>Rather than teaching learners to depend on a single AI platform, we teach principles that remain valuable regardless of which tools become popular in the future.</p>
                  <p className="font-bold text-foreground">Our goal is not to teach people how to use one product. Our goal is to help them become confident builders.</p>
                </div>
              </div>
              <div className="mt-8 lg:mt-0 border-t border-border pt-8 lg:border-t-0 lg:border-l lg:pl-12 lg:pt-0">
                <h4 className="font-heading text-lg font-bold">Evidence-Based Learning</h4>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Our certificates are awarded only after learners complete and submit their projects because we believe meaningful achievement should be supported by practical evidence.
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <Award className="h-8 w-8 text-primary" />
                  <span className="text-sm font-bold uppercase tracking-widest text-foreground">Project-Backed Certification</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Designed for Everyone & Who We Serve */}
      <section className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            
            <div>
              <p className="eyebrow">Inclusivity</p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight">
                Learning Designed for Everyone
              </h2>
              <div className="mt-6 space-y-4 text-lg leading-relaxed text-muted-foreground">
                <p>We believe great education should be accessible to as many people as possible.</p>
                <p>Our programmes combine recorded lessons, live support sessions, practical demonstrations, project-based learning, captions, and written transcripts to create a learning experience that accommodates different learning styles and needs.</p>
                <p className="font-bold text-foreground">Accessibility is not an afterthought. It is part of how we design our programmes.</p>
              </div>
            </div>

            <div className="surface-raised bg-card p-8 sm:p-10">
              <h3 className="font-heading text-xl font-bold mb-6">Who We Serve</h3>
              <div className="flex flex-wrap gap-2">
                {audiences.map((audience, i) => (
                  <span key={i} className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm">
                    {audience}
                  </span>
                ))}
              </div>
              <div className="mt-8 border-t border-border pt-6">
                <p className="text-sm font-medium italic text-muted-foreground">
                  "Technology should create opportunities for everyone, not just those with technical backgrounds."
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 6. Founder Section */}
      <section className="bg-background py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 items-center">
            
            <div className="relative">
              <div className="absolute -inset-4 rounded-xl bg-muted/50 -z-10 transform -rotate-2"></div>
              <Image
                src="/brand/tochukwu-portrait.webp"
                alt="Tochukwu Nkwocha"
                width={720}
                height={900}
                className="aspect-[4/5] w-full rounded-lg bg-brand-ink object-cover shadow-xl"
              />
            </div>

            <div>
              <p className="eyebrow">About Our Founder</p>
              <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
                Tochukwu Nkwocha
              </h2>
              <div className="mt-6 space-y-5 text-lg leading-relaxed text-muted-foreground">
                <p>
                  Tochukwu Nkwocha is the Founder and Lead Instructor of {brand.name}. He builds real digital products for real businesses, but his greatest passion is making complex technology simple enough for ordinary people to understand and use.
                </p>
                <p>
                  Long before Artificial Intelligence became mainstream, he built platforms including Sure Imports and Effiko. Sure Imports has grown to serve more than <strong className="text-foreground">40,000 users</strong>, while Effiko has recorded more than <strong className="text-foreground">10,000 app downloads</strong> and over <strong className="text-foreground">500,000 yearly Google impressions</strong>.
                </p>
                <p>
                  Today, he works alongside AI to design and build modern digital products, including LineScout and the technology platform that powers this academy.
                </p>
                <p className="font-bold text-foreground">
                  His teaching combines practical experience, clear explanations, and a strong belief that technology should be understandable, useful, and accessible to everyone.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 7. The Ecosystem */}
      <section className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="mb-12 text-center max-w-3xl mx-auto">
            <p className="eyebrow">The Platform</p>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
              More Than Courses
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              We are building a complete learning ecosystem where people can continuously develop practical AI skills throughout their personal and professional lives.
            </p>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {/* Using a custom Icon component dynamically from the lucide-react imports */}
            {ecosystemItems.map((item, i) => {
              const Icon = item.icon
              return (
                <div key={i} className="surface-raised flex items-center gap-4 bg-card p-6 transition-shadow hover:shadow-md">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-bold text-foreground">{item.text}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 8. Looking Ahead / Final CTA */}
      <section className="bg-brand-ink py-24 text-center text-white relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[400px] bg-primary/20 blur-[150px] pointer-events-none"></div>
        
        <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8 relative z-10">
          <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
            Looking Ahead
          </h2>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-slate-300">
            <p>Artificial Intelligence will continue to transform how people work, learn, and solve problems.</p>
            <p>The most valuable skill will not simply be knowing how to use today's AI tools. It will be understanding how to think with AI, adapt as technology evolves, and build solutions that improve the lives of others.</p>
            <p className="font-bold text-white">That is the future we are preparing our learners for.</p>
          </div>
          
          <div className="mt-16 border-t border-white/10 pt-16">
            <h2 className="font-heading text-4xl font-black tracking-tight sm:text-5xl">
              Join the Academy
            </h2>
            <p className="mt-6 text-lg text-slate-300">
              Whether you're taking your very first steps into Artificial Intelligence or you're ready to build more advanced digital products, we'd be delighted to welcome you to {brand.name}.
            </p>
            
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link className="btn-inverse px-8 py-4 text-base" href="/courses">
                Explore Our Programmes <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link className="btn-inverse-secondary px-8 py-4 text-base" href="/resources">
                Browse Free Resources
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

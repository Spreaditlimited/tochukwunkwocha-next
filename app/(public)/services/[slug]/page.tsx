import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react"

import { JsonLd } from "@/components/JsonLd"
import { getService } from "@/lib/public-offers"
import { breadcrumbJsonLd, buildMetadata, serviceJsonLd } from "@/lib/site-seo"

type ServicePageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const { slug } = await params
  const service = getService(slug)
  return buildMetadata({
    title: service?.title || "Service",
    description: service?.description || "Service detail route scaffolded for migration parity.",
    path: `/services/${slug}`
  })
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { slug } = await params
  const service = getService(slug) || {
    title: slug.split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" "),
    eyebrow: "Service scaffold",
    description: "Service detail route scaffolded for migration parity.",
    outcome: "Ready to receive migrated form handling and server route logic.",
    href: `/services/${slug}`,
    icon: CheckCircle2
  }
  const Icon = service.icon

  return (
    <main>
      <JsonLd
        data={[
          serviceJsonLd(service),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Services", path: "/services" },
            { name: service.title, path: service.href }
          ])
        ]}
      />
      <section className="relative overflow-hidden bg-brand-ink py-12 text-white">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sky/15 blur-[150px]"></div>
        <div className="container-page relative z-10">
          <Link href="/" className="inline-flex items-center text-sm font-semibold text-brand-sky no-underline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Home
          </Link>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
            <div>
              <p className="eyebrow text-brand-sky">{service.eyebrow}</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">{service.title}</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">{service.description}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/contact" className="btn-primary">
                  Start an enquiry <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link href="/blog" className="btn-secondary">Read practical guides</Link>
              </div>
            </div>
            <aside className="surface-raised border-white/10 bg-white/5 p-6">
              <Icon className="h-8 w-8 text-brand-sky" />
              <p className="mt-5 text-xs font-black uppercase text-slate-400">Migration note</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{service.outcome}</p>
            </aside>
          </div>
        </div>
      </section>
    </main>
  )
}

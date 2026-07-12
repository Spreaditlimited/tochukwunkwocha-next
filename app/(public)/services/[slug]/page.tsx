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
    <main className="container-page py-12">
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
      <Link href="/" className="inline-flex items-center text-sm font-semibold text-primary no-underline">
        <ArrowLeft className="mr-2 h-4 w-4" /> Home
      </Link>
      <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          <p className="eyebrow">{service.eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">{service.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{service.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/contact" className="btn-primary">
              Start an enquiry <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link href="/blog" className="btn-secondary">Read practical guides</Link>
          </div>
        </div>
        <aside className="surface-raised p-6">
          <Icon className="h-8 w-8 text-primary" />
          <p className="mt-5 text-xs font-black uppercase text-muted-foreground">Migration note</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{service.outcome}</p>
        </aside>
      </section>
    </main>
  )
}

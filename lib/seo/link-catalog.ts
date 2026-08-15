import { prisma } from "@/lib/prisma"
import { normalizeLinkableUrl } from "@/lib/seo/link-policy"

export interface SeoLinkCatalogItem { label: string; url: string; useWhen: string }

export const systemSeoLinkCatalog: SeoLinkCatalogItem[] = [
  { label: "Prompt to Profit", url: "/courses/prompt-to-profit", useWhen: "Readers want practical AI skills for useful outputs, services, or income opportunities." },
  { label: "Prompt to Profit Advanced", url: "/courses/prompt-to-production", useWhen: "Readers are ready to move beyond introductory prompting and build production-ready AI workflows, tools, or products." },
  { label: "Build Service", url: "/build", useWhen: "Businesses need a custom dashboard, portal, workflow, automation, or operational web application built for them." },
  { label: "AI Business Plan Service", url: "/services/business-plan", useWhen: "Readers need help turning a business idea into a clear plan, offer, or launch path." },
  { label: "AI for Schools", url: "/schools", useWhen: "Parents, teachers, principals, or school owners are evaluating AI education." },
  { label: "Private AI Build Coaching", url: "/private-ai-build-coaching", useWhen: "Readers need one-to-one help building an AI-assisted project, workflow, or product." },
  { label: "Resource Library", url: "/resources", useWhen: "Readers need practical templates, checklists, or learning resources." },
  { label: "Blog", url: "/blog", useWhen: "Readers need more practical guides before choosing a course or service." },
]

export async function getSeoLinkCatalog(): Promise<SeoLinkCatalogItem[]> {
  const rows = await prisma.tochukwuSeoLinkablePage.findMany({ where: { status: "active" }, orderBy: { id: "asc" }, select: { label: true, url: true } })
  const systemByUrl = new Map(systemSeoLinkCatalog.map((item) => [normalizeLinkableUrl(item.url), item]))
  return rows.map((row) => ({
    label: row.label,
    url: row.url,
    useWhen: systemByUrl.get(normalizeLinkableUrl(row.url))?.useWhen || "Use when this approved page is directly relevant to the reader."
  }))
}

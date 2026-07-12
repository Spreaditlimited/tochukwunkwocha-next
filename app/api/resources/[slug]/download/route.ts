import { NextResponse } from "next/server"

import { buildResourcePdf } from "@/lib/resource-pdf"
import { verifyResourceDownloadToken } from "@/lib/resource-download-token"
import { getResourceBySlug } from "@/lib/resources"
import { slugify } from "@/lib/utils"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const resource = await getResourceBySlug(slug)

  if (!resource) {
    return NextResponse.json({ ok: false, error: "Resource not found." }, { status: 404 })
  }

  if (resource.accessType === "paid" || resource.accessType === "bundle_only") {
    return NextResponse.json({ ok: false, error: "This resource requires checkout access." }, { status: 403 })
  }

  if (resource.accessType === "gated") {
    const token = new URL(request.url).searchParams.get("token") || ""
    if (!verifyResourceDownloadToken(token, resource.slug)) {
      return NextResponse.json({ ok: false, error: "Unlock this resource before downloading it." }, { status: 403 })
    }
  }

  const pdf = await buildResourcePdf(resource)
  const filename = `${slugify(resource.title) || resource.slug}.pdf`

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store"
    }
  })
}

import { NextResponse } from "next/server"

import { getLeadMagnetFileBySlug } from "@/lib/blog-automation"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const slug = String(url.searchParams.get("slug") || "").trim()
  if (!slug) return NextResponse.json({ ok: false, error: "Lead magnet slug is required." }, { status: 400 })

  try {
    const file = await getLeadMagnetFileBySlug(slug)
    if (!file || !file.buffer.length) return NextResponse.json({ ok: false, error: "Lead magnet PDF not found." }, { status: 404 })

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "content-type": file.contentType,
        "content-length": String(file.byteSize || file.buffer.length),
        "content-disposition": `inline; filename="${file.filename.replace(/"/g, "")}"`,
        "cache-control": "no-store, max-age=0"
      }
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not download lead magnet PDF." },
      { status: 500 }
    )
  }
}

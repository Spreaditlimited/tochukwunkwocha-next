import { NextResponse } from "next/server"

import { loadNetlifyAccess, saveNetlifyAccess } from "@/lib/student-domain-actions"
import { requireStudent } from "@/lib/student-auth"

export async function GET(request: Request) {
  const session = await requireStudent()
  try {
    const domainName = new URL(request.url).searchParams.get("domainName") || ""
    const result = await loadNetlifyAccess(session.account.id, domainName)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not load Netlify details." }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const session = await requireStudent()
  const body = await request.json().catch(() => null)
  try {
    const result = await saveNetlifyAccess({
      accountId: session.account.id,
      email: session.account.email,
      domainName: String(body?.domainName || body?.domain_name || ""),
      netlifyEmail: String(body?.netlifyEmail || body?.netlify_email || ""),
      netlifyWorkspace: String(body?.netlifyWorkspace || body?.netlify_workspace || ""),
      netlifySiteName: String(body?.netlifySiteName || body?.netlify_site_name || ""),
      accessDetails: String(body?.accessDetails || body?.access_details || "")
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not save Netlify details." }, { status: 400 })
  }
}

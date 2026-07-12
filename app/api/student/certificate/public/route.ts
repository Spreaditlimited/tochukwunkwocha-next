import { NextResponse } from "next/server"

import { getStudentCertificatePublic } from "@/lib/student-dashboard"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const certificateNo = clean(url.searchParams.get("certificate_no") || url.searchParams.get("certificateNo"), 140).toUpperCase()
  if (!certificateNo) {
    return NextResponse.json({ ok: false, error: "certificate_no is required" }, { status: 400 })
  }

  try {
    const certificate = await getStudentCertificatePublic(certificateNo)
    if (!certificate) return NextResponse.json({ ok: false, error: "Certificate not found" }, { status: 404 })
    return NextResponse.json({
      ok: true,
      certificate
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not load certificate." }, { status: 500 })
  }
}

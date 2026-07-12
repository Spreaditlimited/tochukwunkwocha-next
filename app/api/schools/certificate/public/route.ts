import { NextRequest, NextResponse } from "next/server"

import { getSchoolCertificatePublic } from "@/lib/school-dashboard"

export async function GET(request: NextRequest) {
  const certificateNo = request.nextUrl.searchParams.get("certificate_no") || request.nextUrl.searchParams.get("certificateNo") || ""
  if (!certificateNo.trim()) {
    return NextResponse.json({ ok: false, error: "certificate_no is required" }, { status: 400 })
  }

  const certificate = await getSchoolCertificatePublic(certificateNo)
  if (!certificate) {
    return NextResponse.json({ ok: false, error: "Certificate not found." }, { status: 404 })
  }

  return NextResponse.json({ ok: true, certificate })
}

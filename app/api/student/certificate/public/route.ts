import { NextResponse } from "next/server"

import { getStudentCertificatePublic } from "@/lib/student-dashboard"
import { studentApiErrorResponse } from "@/lib/student-api-error"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const certificateNo = clean(url.searchParams.get("certificate_no") || url.searchParams.get("certificateNo"), 140).toUpperCase()
  if (!certificateNo) {
    return NextResponse.json({ ok: false, error: "Enter a certificate number." }, { status: 400 })
  }

  try {
    const certificate = await getStudentCertificatePublic(certificateNo)
    if (!certificate) return NextResponse.json({ ok: false, error: "Certificate not found" }, { status: 404 })
    return NextResponse.json({
      ok: true,
      certificate
    })
  } catch (error) {
    return studentApiErrorResponse(error, "Could not load certificate.", { status: 500, context: "student_certificate_public_failed" })
  }
}

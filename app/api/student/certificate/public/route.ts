import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { courseName } from "@/lib/student-dashboard"

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
    const rows = await prisma.$queryRaw<
      Array<{
        certificateNo: string | null
        recipientName: string | null
        issuedAt: Date | null
        courseSlug: string | null
        studentName: string | null
        studentEmail: string | null
      }>
    >`
      SELECT
        c.certificate_no AS certificateNo,
        c.recipient_name AS recipientName,
        c.issued_at AS issuedAt,
        c.course_slug AS courseSlug,
        a.full_name AS studentName,
        a.email AS studentEmail
      FROM student_certificates c
      JOIN student_accounts a ON a.id = c.account_id
      WHERE c.certificate_no = ${certificateNo}
        AND c.status = 'issued'
      LIMIT 1
    `
    const row = rows[0]
    if (!row) return NextResponse.json({ ok: false, error: "Certificate not found" }, { status: 404 })
    return NextResponse.json({
      ok: true,
      certificate: {
        certificateNo: clean(row.certificateNo, 140),
        issuedAt: row.issuedAt ? row.issuedAt.toISOString() : null,
        courseSlug: clean(row.courseSlug, 120),
        courseName: courseName(clean(row.courseSlug, 120)),
        studentName: clean(row.recipientName || row.studentName, 180),
        studentEmail: clean(row.studentEmail, 220)
      }
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not load certificate." }, { status: 500 })
  }
}

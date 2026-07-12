import crypto from "crypto"
import { NextResponse } from "next/server"

import { getLearningSupportForStudent } from "@/lib/learning-player"
import { requireStudent } from "@/lib/student-auth"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export async function POST(request: Request) {
  const session = await requireStudent()
  const body = await request.json().catch(() => null)
  const courseSlug = clean(body?.courseSlug || body?.course_slug, 120).toLowerCase()
  const cloudName = clean(process.env.CLOUDINARY_CLOUD_NAME, 190)
  const apiKey = clean(process.env.CLOUDINARY_API_KEY, 190)
  const apiSecret = clean(process.env.CLOUDINARY_API_SECRET, 1000)
  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ ok: false, error: "Cloudinary not configured" }, { status: 500 })
  }
  if (!courseSlug) return NextResponse.json({ ok: false, error: "courseSlug is required" }, { status: 400 })

  try {
    const support = await getLearningSupportForStudent(session.account.id, session.account.email, courseSlug)
    if (!support.features.assignmentsEnabled) {
      return NextResponse.json({ ok: false, error: "Assignment submission is currently disabled for this course." }, { status: 403 })
    }
    const timestamp = Math.floor(Date.now() / 1000)
    const folder = ["tochukwunkwocha-site", "learning-assignments", courseSlug, `acct-${String(session.account.id)}`].join("/")
    const source = `folder=${folder}&timestamp=${timestamp}${apiSecret}`
    const signature = crypto.createHash("sha1").update(source).digest("hex")
    return NextResponse.json({ ok: true, cloudName, apiKey, timestamp, folder, signature })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not prepare upload." }, { status: 400 })
  }
}

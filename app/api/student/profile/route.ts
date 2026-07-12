import { NextResponse } from "next/server"

import { getStudentProfile, getStudentSession, updateStudentProfile } from "@/lib/student-auth"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export async function GET() {
  const session = await getStudentSession()
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const profile = await getStudentProfile(session.account.id)
  return NextResponse.json({ ok: true, profile })
}

export async function POST(request: Request) {
  const session = await getStudentSession()
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })

  try {
    const profile = await updateStudentProfile(session.account.id, {
      fullName: clean(body.fullName, 180),
      phoneE164: clean(body.phoneE164 || body.phone, 20),
      whatsappOptedIn: body.whatsappOptedIn === true,
      demographicCountry: clean(body.demographicCountry, 120),
      demographicRegion: clean(body.demographicRegion, 120),
      ageBand: clean(body.ageBand, 40),
      gender: clean(body.gender, 40),
      learnerCategory: clean(body.learnerCategory, 80)
    })
    const refreshed = await getStudentProfile(session.account.id)
    return NextResponse.json({
      ok: true,
      profile: {
        accountUuid: profile.accountUuid,
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phoneE164 || "",
        whatsappOptedIn: profile.whatsappOptedIn,
        whatsappOptedInAt: profile.whatsappOptedInAt,
        whatsappOptedOutAt: profile.whatsappOptedOutAt,
        certificateNameConfirmedAt: profile.certificateNameConfirmedAt,
        certificateNameUpdatedAt: profile.certificateNameUpdatedAt,
        certificateNameNeedsConfirmation: !profile.certificateNameConfirmedAt,
        demographicCountry: refreshed.demographicCountry,
        demographicRegion: refreshed.demographicRegion,
        ageBand: refreshed.ageBand,
        gender: refreshed.gender,
        learnerCategory: refreshed.learnerCategory,
        demographicUpdatedAt: refreshed.demographicUpdatedAt
      }
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not update profile" },
      { status: 400 }
    )
  }
}

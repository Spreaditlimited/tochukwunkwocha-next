import { NextResponse } from "next/server"

import { recordLearningFollowupClick } from "@/lib/learning-inactivity-followups"
import { publicAbsoluteUrl } from "@/lib/public-site-url"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || ""
  const destination = await recordLearningFollowupClick(token).catch((error) => {
    console.error("learning_followup_click_failed", error)
    return null
  })
  return NextResponse.redirect(destination || publicAbsoluteUrl("/dashboard/courses"), 302)
}

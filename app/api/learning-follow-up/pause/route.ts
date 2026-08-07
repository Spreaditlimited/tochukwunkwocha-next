import { NextResponse } from "next/server"

import { pauseLearningFollowupsFromToken } from "@/lib/learning-inactivity-followups"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || ""
  const paused = await pauseLearningFollowupsFromToken(token).catch((error) => {
    console.error("learning_followup_pause_failed", error)
    return false
  })
  const title = paused ? "Course reminders paused" : "This reminder link is invalid or has expired"
  const message = paused
    ? "Weekly course-progress emails for this programme have been paused. Your course access is unchanged."
    : "No reminder preference was changed."
  return new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#f4f8fc;color:#06162d;font-family:Arial,sans-serif"><main style="max-width:620px;margin:64px auto;padding:32px;border:1px solid #dbe7f3;border-radius:18px;background:#fff"><p style="font-size:12px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:#0d4f9a">Tochukwu Tech and AI Academy</p><h1>${title}</h1><p style="line-height:1.7;color:#334155">${message}</p><a href="/dashboard/courses" style="display:inline-block;margin-top:12px;padding:12px 18px;border-radius:10px;background:#0d4f9a;color:#fff;text-decoration:none;font-weight:800">Open dashboard</a></main></body></html>`, {
    status: paused ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  })
}

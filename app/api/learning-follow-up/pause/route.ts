import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"

import {
  learningFollowupPauseRequestFromToken,
  pauseLearningFollowupsFromToken
} from "@/lib/learning-inactivity-followups"

export const dynamic = "force-dynamic"

const CONFIRMATION_COOKIE = "tochukwu_learning_pause_confirmation"

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function confirmationHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("base64url")
}

function hashesMatch(left: string, right: string) {
  const first = Buffer.from(left)
  const second = Buffer.from(right)
  return first.length === second.length && crypto.timingSafeEqual(first, second)
}

function page(input: {
  title: string
  message: string
  status: number
  token?: string
  courseSlug?: string
  preview?: boolean
}) {
  const courseName = String(input.courseSlug || "this programme")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
  const state = input.token || input.preview ? "confirm" : input.status >= 400 ? "error" : "success"
  const icon = state === "confirm"
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v4m0 4h.01M10.3 3.6 2.5 17.1A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.9L13.7 3.6a2 2 0 0 0-3.4 0Z"/></svg>`
    : state === "success"
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>`
  const form = input.token ? `
    <form method="post" action="/api/learning-follow-up/pause" class="actions">
      <input type="hidden" name="token" value="${escapeHtml(input.token)}">
      <button type="submit" class="button button-danger">Pause reminders</button>
      <a href="/dashboard/courses" class="button button-secondary">Keep reminders active</a>
    </form>` : input.preview ? `
    <div class="preview-note">Local design preview — these buttons do not change any reminder settings.</div>
    <div class="actions">
      <button type="button" class="button button-danger" disabled>Pause reminders</button>
      <button type="button" class="button button-secondary" disabled>Keep reminders active</button>
    </div>` : `
    <div class="actions single-action"><a href="/dashboard/courses" class="button button-primary">Open dashboard</a></div>`
  return new NextResponse(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>${escapeHtml(input.title)} · Tochukwu Tech and AI Academy</title>
  <style>
    :root{color-scheme:light;--ink:#07162d;--muted:#5d6b7e;--blue:#0d4f9a;--sky:#75c8e8;--paper:#f7fafc;--line:#d9e4ee;--danger:#b42318;--danger-dark:#901d14;--success:#087443}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;background:radial-gradient(circle at 15% 12%,rgba(117,200,232,.34),transparent 32rem),linear-gradient(145deg,#f8fbfd 0%,#eef6fb 100%);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
    .page{min-height:100vh;display:grid;place-items:center;padding:32px 20px}
    .shell{width:min(100%,640px)}
    .brand{display:flex;align-items:center;gap:12px;margin:0 auto 18px;width:max-content;color:var(--ink);font-size:13px;font-weight:800;letter-spacing:.01em}
    .brand-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:var(--ink);color:white;box-shadow:0 8px 22px rgba(7,22,45,.18)}
    .brand-mark span{font-size:15px;font-weight:900;letter-spacing:-.06em}
    .card{overflow:hidden;border:1px solid rgba(13,79,154,.17);border-radius:22px;background:rgba(255,255,255,.96);box-shadow:0 24px 70px rgba(7,22,45,.12)}
    .accent{height:5px;background:linear-gradient(90deg,var(--blue),var(--sky))}
    .content{padding:38px 40px 40px;text-align:center}
    .icon{display:grid;place-items:center;width:58px;height:58px;margin:0 auto 22px;border-radius:18px}
    .icon svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .icon-confirm{background:#fff4e8;color:#b45309}.icon-success{background:#e9f8f0;color:var(--success)}.icon-error{background:#fff0ef;color:var(--danger)}
    .eyebrow{margin:0 0 10px;color:var(--blue);font-size:11px;font-weight:900;letter-spacing:.15em;text-transform:uppercase}
    h1{margin:0;font-size:clamp(25px,5vw,34px);line-height:1.15;letter-spacing:-.035em}
    .lead{max-width:510px;margin:16px auto 0;color:#41516a;font-size:16px;line-height:1.65}
    .notice{margin:22px 0 0;padding:15px 17px;border:1px solid var(--line);border-radius:13px;background:var(--paper);color:var(--muted);font-size:14px;line-height:1.55;text-align:left}
    .notice strong{color:var(--ink)}
    .preview-note{margin:18px auto -8px;color:#7c5b13;font-size:12px;font-weight:750;line-height:1.5}
    .actions{display:flex;justify-content:center;gap:12px;margin-top:28px}
    .button{display:inline-flex;min-height:48px;align-items:center;justify-content:center;border:1px solid transparent;border-radius:10px;padding:12px 20px;font:inherit;font-size:14px;font-weight:800;line-height:1.2;text-decoration:none;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,background .15s ease}
    .button:hover{transform:translateY(-1px)}.button:active{transform:translateY(0)}
    .button:focus-visible{outline:3px solid rgba(117,200,232,.75);outline-offset:3px}
    .button:disabled{cursor:not-allowed;opacity:.72}.button:disabled:hover{transform:none}
    .button-danger{background:var(--danger);color:white;box-shadow:0 8px 20px rgba(180,35,24,.18)}.button-danger:hover{background:var(--danger-dark)}
    .button-secondary{border-color:#c9d6e2;background:white;color:var(--ink)}.button-secondary:hover{border-color:#9fb3c7;background:#f7fafc}
    .button-primary{background:var(--blue);color:white;box-shadow:0 8px 20px rgba(13,79,154,.2)}.button-primary:hover{background:#0a3f7d}
    .single-action{margin-top:26px}
    .footer{margin:17px 0 0;text-align:center;color:#758397;font-size:12px;line-height:1.5}
    @media(max-width:540px){.page{padding:20px 14px}.brand{font-size:12px}.content{padding:30px 21px 27px}.card{border-radius:18px}.actions{flex-direction:column}.button{width:100%}.button-secondary{order:-1}.lead{font-size:15px}.notice{text-align:center}}
    @media(prefers-reduced-motion:reduce){.button{transition:none}}
  </style>
</head>
<body>
  <main class="page">
    <div class="shell">
      <div class="brand"><span class="brand-mark"><span>TT</span></span><span>Tochukwu Tech and AI Academy</span></div>
      <section class="card" aria-labelledby="page-title">
        <div class="accent"></div>
        <div class="content">
          <div class="icon icon-${state}">${icon}</div>
          <p class="eyebrow">Course progress reminders</p>
          <h1 id="page-title">${escapeHtml(input.title)}</h1>
          <p class="lead">${escapeHtml(input.message)}</p>
          ${input.token || input.preview ? `<div class="notice"><strong>What changes:</strong> Weekly reminders for ${escapeHtml(courseName)} will stop. Your course access, completed lessons and learning progress will remain exactly as they are.</div>` : ""}
          ${form}
        </div>
      </section>
      <p class="footer">You can continue learning from your dashboard at any time.</p>
    </div>
  </main>
</body>
</html>`, {
    status: input.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex, nofollow"
    }
  })
}

export async function GET(request: NextRequest) {
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname)
  if (request.nextUrl.searchParams.get("preview") === "1" && isLocalhost) {
    const courseSlug = String(request.nextUrl.searchParams.get("course") || "this-programme")
      .replace(/[^a-z0-9-]/gi, "")
      .slice(0, 120)
    return page({
      title: "Pause course-progress reminders?",
      message: "Nothing has been paused yet. Confirm below only if you want to stop these weekly emails.",
      status: 200,
      courseSlug,
      preview: true
    })
  }
  const token = request.nextUrl.searchParams.get("token") || ""
  const pauseRequest = learningFollowupPauseRequestFromToken(token)
  if (!pauseRequest) {
    return page({
      title: "This reminder link is invalid or has expired",
      message: "No reminder preference was changed.",
      status: 400
    })
  }
  const response = page({
    title: "Pause course-progress reminders?",
    message: "Nothing has been paused yet. Confirm below only if you want to stop these weekly emails.",
    status: 200,
    token,
    courseSlug: pauseRequest.courseSlug
  })
  response.cookies.set(CONFIRMATION_COOKIE, confirmationHash(token), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/learning-follow-up/pause",
    maxAge: 10 * 60
  })
  return response
}

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null)
  const token = String(formData?.get("token") || "")
  const expected = confirmationHash(token)
  const received = request.cookies.get(CONFIRMATION_COOKIE)?.value || ""
  if (!token || !received || !hashesMatch(received, expected)) {
    return page({
      title: "Please open the reminder link again",
      message: "The confirmation session is missing or has expired. No reminder preference was changed.",
      status: 400
    })
  }
  const paused = await pauseLearningFollowupsFromToken(token).catch((error) => {
    console.error("learning_followup_pause_failed", error)
    return false
  })
  const response = paused
    ? page({
        title: "Course reminders paused",
        message: "Weekly course-progress emails for this programme have been paused. Your course access is unchanged.",
        status: 200
      })
    : page({
        title: "This reminder link is invalid or has expired",
        message: "No reminder preference was changed.",
        status: 400
      })
  response.cookies.set(CONFIRMATION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/learning-follow-up/pause",
    maxAge: 0
  })
  return response
}

import { NextResponse } from "next/server"

export const runtime = "nodejs"

// Do not forward POST bodies across domains or accept submissions into the
// retired inbox. Previously opened forms retain their text on this error.
export async function POST() {
  return NextResponse.json({
    ok: false,
    error: "Anonymous questions and answers have moved to UnsaidBox. Your message was not sent. Copy your text, then reopen this page to continue on UnsaidBox.",
    destination: "https://unsaidbox.com/u/tochukwu/ask"
  }, { status: 410, headers: { "Cache-Control": "no-store" } })
}

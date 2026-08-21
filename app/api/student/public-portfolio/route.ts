import { NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"

import { requireStudent } from "@/lib/student-auth"
import { studentApiErrorResponse } from "@/lib/student-api-error"
import { getStudentPublicPortfolioEditor, saveStudentPublicPortfolio } from "@/lib/student-public-profile"

export async function GET() {
  try {
    const session = await requireStudent()
    const portfolio = await getStudentPublicPortfolioEditor(session.account.id)
    return NextResponse.json({ ok: true, portfolio })
  } catch (error) {
    return studentApiErrorResponse(error, "Could not load your public portfolio.", { status: 500, context: "student_public_portfolio_load_failed" })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireStudent()
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "The portfolio details could not be processed." }, { status: 400 })
    }
    const portfolio = await saveStudentPublicPortfolio(session.account.id, body as Record<string, unknown>)
    revalidateTag("public-student-projects")
    revalidatePath("/projects")
    revalidatePath(`/projects/${portfolio.publicSlug}`)
    return NextResponse.json({ ok: true, portfolio })
  } catch (error) {
    return studentApiErrorResponse(error, "Could not save your public portfolio.", { status: 400, context: "student_public_portfolio_save_failed" })
  }
}

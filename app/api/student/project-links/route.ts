import { NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"

import {
  createStudentProjectLink,
  deleteStudentProjectLink,
  listStudentProjectLinks,
  updateStudentProjectLinkVisibility
} from "@/lib/student-project-links"
import { requireStudent } from "@/lib/student-auth"

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

export async function GET() {
  try {
    const session = await requireStudent()
    const links = await listStudentProjectLinks(session.account.id)
    return NextResponse.json({ ok: true, links })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load project links." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireStudent()
    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 })

    const links = await createStudentProjectLink({
      accountId: session.account.id,
      title: clean(body.title, 220),
      projectUrl: clean(body.projectUrl || body.project_url, 1500),
      description: clean(body.description, 1000),
      courseSlug: clean(body.courseSlug || body.course_slug, 120),
      certificateNo: clean(body.certificateNo || body.certificate_no, 140),
      declarationAccepted: body.declarationAccepted === true
    })
    revalidateTag("public-student-projects")
    revalidatePath("/projects")
    return NextResponse.json({ ok: true, links })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not save project link." },
      { status: 400 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireStudent()
    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 })
    const action = clean(body.action, 40)
    const linkUuid = clean(body.linkUuid || body.link_uuid, 80)
    const links = action === "delete"
      ? await deleteStudentProjectLink(session.account.id, linkUuid)
      : await updateStudentProjectLinkVisibility(session.account.id, linkUuid, body.isPublic === true)
    revalidateTag("public-student-projects")
    revalidatePath("/projects")
    return NextResponse.json({ ok: true, links })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not update project link." },
      { status: 400 }
    )
  }
}

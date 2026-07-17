import { NextRequest, NextResponse } from "next/server"

import { listAdminWhatsAppContacts, saveAdminWhatsAppContacts } from "@/lib/admin-whatsapp"
import { requireAdmin } from "@/lib/auth"

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export async function GET() {
  await requireAdmin("/internal/whatsapp")

  try {
    const contacts = await listAdminWhatsAppContacts(true)
    return NextResponse.json({ statusx: "SUCCESS", data: contacts })
  } catch (error) {
    return NextResponse.json(
      { statusx: "ERROR", message: errorMessage(error, "Failed to load WhatsApp contacts.") },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdmin("/internal/whatsapp")

  try {
    const body = await request.json()
    const contacts = Array.isArray(body?.contacts) ? body.contacts : []
    const savedContacts = await saveAdminWhatsAppContacts({
      contacts,
      adminUuid: session.adminUuid
    })

    return NextResponse.json({ statusx: "SUCCESS", data: savedContacts })
  } catch (error) {
    return NextResponse.json(
      { statusx: "ERROR", message: errorMessage(error, "Failed to save WhatsApp contacts.") },
      { status: 400 }
    )
  }
}

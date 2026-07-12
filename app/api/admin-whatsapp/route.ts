import { NextResponse } from "next/server"

import { getPublicWhatsAppContacts } from "@/lib/public-whatsapp"

export async function GET() {
  try {
    const contacts = await getPublicWhatsAppContacts()

    return NextResponse.json({
      statusx: "SUCCESS",
      data: contacts
    })
  } catch (error) {
    return NextResponse.json({
      statusx: "SUCCESS",
      data: [],
      fallback: true,
      error: error instanceof Error ? error.message : "WhatsApp contacts unavailable"
    })
  }
}

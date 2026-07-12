import crypto from "crypto"
import { NextResponse } from "next/server"

const maxBytes = 8 * 1024 * 1024
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"])

export async function POST(request: Request) {
  try {
    const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim()
    const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim()
    const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim()
    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ ok: false, error: "Cloudinary is not configured." }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Payment proof file is required." }, { status: 400 })
    }
    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ ok: false, error: "Upload a JPG, PNG, WebP, or PDF proof file." }, { status: 400 })
    }
    if (file.size <= 0 || file.size > maxBytes) {
      return NextResponse.json({ ok: false, error: "Proof file must be 8MB or smaller." }, { status: 400 })
    }

    const folder = "tochukwunkwocha-site/manual-payments"
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = crypto.createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest("hex")
    const uploadBody = new FormData()
    uploadBody.set("file", file)
    uploadBody.set("folder", folder)
    uploadBody.set("timestamp", String(timestamp))
    uploadBody.set("api_key", apiKey)
    uploadBody.set("signature", signature)

    const resourceType = file.type === "application/pdf" ? "raw" : "image"
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
      method: "POST",
      body: uploadBody
    })
    const json = await response.json().catch(() => null)
    if (!response.ok || !json?.secure_url || !json?.public_id) {
      return NextResponse.json({ ok: false, error: json?.error?.message || "Could not upload payment proof." }, { status: 502 })
    }

    return NextResponse.json({
      ok: true,
      url: String(json.secure_url),
      publicId: String(json.public_id),
      resourceType
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not upload payment proof." }, { status: 500 })
  }
}

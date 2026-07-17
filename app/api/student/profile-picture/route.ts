import crypto from "crypto"
import { NextResponse } from "next/server"

import {
  clearStudentProfilePicture,
  detectStudentProfilePictureType,
  getStudentProfilePicture,
  saveStudentProfilePicture,
  STUDENT_PROFILE_PICTURE_ALLOWED_TYPES,
  STUDENT_PROFILE_PICTURE_MAX_BYTES
} from "@/lib/student-profile-picture"
import { getStudentSession } from "@/lib/student-auth"

function clean(value: unknown, max = 1000) {
  return String(value || "").trim().slice(0, max)
}

function cloudinaryConfig() {
  const cloudName = clean(process.env.CLOUDINARY_CLOUD_NAME, 190)
  const apiKey = clean(process.env.CLOUDINARY_API_KEY, 190)
  const apiSecret = clean(process.env.CLOUDINARY_API_SECRET, 1000)
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Profile picture uploads are not configured.")
  return { cloudName, apiKey, apiSecret }
}

function signCloudinary(params: Record<string, string | number>, secret: string) {
  const source = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&")
  return crypto.createHash("sha1").update(`${source}${secret}`).digest("hex")
}

export async function POST(request: Request) {
  const session = await getStudentSession()
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Choose a profile picture to upload." }, { status: 400 })
    }
    if (!STUDENT_PROFILE_PICTURE_ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ ok: false, error: "Upload a JPG, PNG, or WebP image." }, { status: 400 })
    }
    if (file.size <= 0 || file.size > STUDENT_PROFILE_PICTURE_MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "Profile picture must be 1 MB or smaller." }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const detectedType = detectStudentProfilePictureType(bytes)
    if (!detectedType || detectedType !== file.type) {
      return NextResponse.json({ ok: false, error: "The selected file is not a valid JPG, PNG, or WebP image." }, { status: 400 })
    }

    const config = cloudinaryConfig()
    const timestamp = Math.floor(Date.now() / 1000)
    const params = {
      folder: "tochukwunkwocha-site/student-profile-pictures",
      invalidate: "true",
      overwrite: "true",
      public_id: `student-${session.account.accountUuid}`,
      timestamp,
      transformation: "c_fill,g_auto,h_512,w_512"
    }
    const uploadBody = new FormData()
    uploadBody.set("file", new Blob([bytes], { type: detectedType }), file.name || "profile-picture")
    uploadBody.set("api_key", config.apiKey)
    Object.entries(params).forEach(([key, value]) => uploadBody.set(key, String(value)))
    uploadBody.set("signature", signCloudinary(params, config.apiSecret))

    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`, {
      method: "POST",
      body: uploadBody
    })
    const uploaded = await response.json().catch(() => null)
    if (!response.ok || !uploaded?.secure_url || !uploaded?.public_id) {
      throw new Error(uploaded?.error?.message || "Could not upload the profile picture.")
    }

    const profilePictureUrl = clean(uploaded.secure_url, 2000)
    await saveStudentProfilePicture({
      accountId: session.account.id,
      url: profilePictureUrl,
      publicId: clean(uploaded.public_id, 500)
    })
    return NextResponse.json({ ok: true, profilePictureUrl })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not upload the profile picture." },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  const session = await getStudentSession()
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  try {
    const current = await getStudentProfilePicture(session.account.id)
    if (current.publicId) {
      const config = cloudinaryConfig()
      const timestamp = Math.floor(Date.now() / 1000)
      const params = { invalidate: "true", public_id: current.publicId, timestamp }
      const destroyBody = new FormData()
      destroyBody.set("api_key", config.apiKey)
      Object.entries(params).forEach(([key, value]) => destroyBody.set(key, String(value)))
      destroyBody.set("signature", signCloudinary(params, config.apiSecret))
      const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/destroy`, {
        method: "POST",
        body: destroyBody
      })
      const destroyed = await response.json().catch(() => null)
      if (!response.ok || !["ok", "not found"].includes(String(destroyed?.result || ""))) {
        throw new Error(destroyed?.error?.message || "Could not remove the profile picture.")
      }
    }
    await clearStudentProfilePicture(session.account.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not remove the profile picture." },
      { status: 500 }
    )
  }
}

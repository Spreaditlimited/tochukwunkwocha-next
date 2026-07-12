import { cookies } from "next/headers"

const COOKIE_NAME = "tochukwu_internal_toast"

export type InternalToastType = "success" | "error" | "info"

export type InternalToastPayload = {
  type?: InternalToastType
  title: string
  message?: string
}

export async function setInternalToast(payload: InternalToastPayload) {
  const cookieStore = await cookies()
  const value = encodeURIComponent(JSON.stringify({
    type: payload.type || "success",
    title: payload.title,
    message: payload.message || "",
    createdAt: Date.now()
  }))

  cookieStore.set(COOKIE_NAME, value, {
    path: "/internal",
    maxAge: 60,
    sameSite: "lax"
  })
}

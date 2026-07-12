import { cookies } from "next/headers"

const COOKIE_NAME = "tochukwu_student_toast"

export type StudentToastType = "success" | "error" | "info"

export type StudentToastPayload = {
  type?: StudentToastType
  title: string
  message?: string
}

export async function setStudentToast(payload: StudentToastPayload) {
  const cookieStore = await cookies()
  const value = encodeURIComponent(JSON.stringify({
    type: payload.type || "success",
    title: payload.title,
    message: payload.message || "",
    createdAt: Date.now()
  }))

  cookieStore.set(COOKIE_NAME, value, {
    path: "/dashboard",
    maxAge: 60,
    sameSite: "lax"
  })
}

import { NextResponse } from "next/server"

import { studentErrorLogValue, studentSafeErrorMessage } from "@/lib/student-error-feedback"

type StudentApiErrorOptions = {
  status?: number
  context?: string
  headers?: HeadersInit
  details?: Record<string, string | number | boolean | null | undefined>
}

export function studentApiErrorResponse(
  error: unknown,
  fallback: string,
  options: StudentApiErrorOptions = {}
) {
  console.error(options.context || "student_api_request_failed", {
    ...options.details,
    error: studentErrorLogValue(error)
  })
  return NextResponse.json(
    { ok: false, error: studentSafeErrorMessage(error, fallback) },
    { status: options.status || 500, headers: options.headers }
  )
}

const TECHNICAL_ERROR_PATTERNS = [
  /prisma/i,
  /\$executeRaw|\$queryRaw|\$transaction/i,
  /transaction api|transaction already closed|expired transaction/i,
  /invalid `[^`]+` invocation/i,
  /database server|sql syntax|query engine|constraint failed|duplicate entry/i,
  /node_modules|webpack|next\/dist|\.tsx?:\d+|\.mjs:\d+/i,
  /\/(?:Users|var|private|app|workspace)\//i,
  /(?:ECONN|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|fetch failed|socket hang up)/i,
  /(?:TypeError|ReferenceError|SyntaxError|PrismaClient\w*Error)/i,
  /(?:api[_ -]?key|api[_ -]?secret|DATABASE_URL|CLOUDINARY_|BREVO_|VERCEL_)/i,
  /(?:stack trace|\n\s*at\s+)/i,
  /(?:request id|trace id|clientVersion|errorCode)/i,
  /(?:cloudinary|upload preset|invalid signature|not configured|configuration missing)/i,
  /(?:timed? ?out|timeout exceeded)/i,
  /^Invalid JSON body\.?$/i,
  /^\s*[\[{][\s\S]*[\]}]\s*$/,
  /<!doctype|<html/i
]

function messageFrom(error: unknown) {
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>
    if (typeof record.error === "string") return record.error
    if (typeof record.message === "string") return record.message
  }
  return ""
}

export function studentSafeErrorMessage(error: unknown, fallback: string) {
  const safeFallback = String(fallback || "Something went wrong. Please try again.").trim()
  const candidate = messageFrom(error).replace(/\s+/g, " ").trim()
  if (!candidate || candidate.length > 500) return safeFallback
  if (TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(candidate))) return safeFallback
  return candidate
}

export function studentErrorLogValue(error: unknown) {
  if (error instanceof Error) return error.message
  return typeof error === "string" ? error : String(error)
}

export interface AdminPermissionSession {
  isOwner: boolean
  allowedPages: string[]
}

export function normalizeInternalPath(value: string) {
  const path = String(value || "").trim()
  if (!path) return ""
  const withSlash = path.startsWith("/") ? path : `/${path}`
  return withSlash.replace(/\/+$/, "") || "/"
}

export function isSafeInternalPath(path: string) {
  return /^\/internal(?:\/[a-z0-9-]+)*$/.test(path)
}

export function canAccessDashboardPath(session: AdminPermissionSession, path: string) {
  if (session.isOwner) return true
  if (!session.allowedPages.length) return false
  const normalizedPath = normalizeInternalPath(path)
  return session.allowedPages.some((allowed) => {
    const normalizedAllowed = normalizeInternalPath(allowed)
    if (normalizedAllowed === "/internal") return normalizedPath === "/internal"
    return normalizedPath === normalizedAllowed || normalizedPath.startsWith(`${normalizedAllowed}/`)
  })
}

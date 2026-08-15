export function normalizeDeliverableEmail(value: unknown, maxLength = 320) {
  const email = String(value || "").trim().toLowerCase().slice(0, maxLength)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ""

  const domain = email.split("@").at(-1) || ""
  if (domain === "localhost" || domain === "student-code.local" || domain.endsWith(".local") || domain.endsWith(".localhost")) return ""

  return email
}

export function isDeliverableEmail(value: unknown) {
  return Boolean(normalizeDeliverableEmail(value))
}

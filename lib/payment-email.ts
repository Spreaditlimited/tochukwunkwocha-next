const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  "gmail.con": "gmail.com",
  "gmail.cmo": "gmail.com",
  "gmail.co": "gmail.com",
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "yahoo.con": "yahoo.com",
  "yahoo.cmo": "yahoo.com",
  "hotmail.con": "hotmail.com",
  "outlook.con": "outlook.com",
  "icloud.con": "icloud.com"
}

const IMPOSSIBLE_TLD_TYPOS = new Set(["cim", "cmo", "comm", "con", "gomal", "om", "vom", "xom"])
const INTERNAL_FAMILY_LEARNER_EMAIL = /^family-child-[a-f0-9]{32}@student-code\.local$/i

export type PaymentEmailValidation = {
  email: string
  valid: boolean
  error: string
  suggestion: string
}

export function validatePaymentEmail(value: unknown): PaymentEmailValidation {
  const email = String(value || "").trim().toLowerCase()
  const invalid = (error: string, suggestion = ""): PaymentEmailValidation => ({ email: "", valid: false, error, suggestion })
  if (!email) return invalid("Enter your email address.")
  if (email.length > 254) return invalid("Enter a valid email address.")

  const at = email.lastIndexOf("@")
  if (at <= 0 || at !== email.indexOf("@")) return invalid("Enter a valid email address.")
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (!local || local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return invalid("Enter a valid email address.")
  }
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return invalid("Enter a valid email address.")
  if (!domain || domain.length > 253 || domain === "localhost" || domain.endsWith(".local") || domain.endsWith(".localhost")) {
    return invalid("Enter a valid public email address.")
  }
  const labels = domain.split(".")
  if (labels.length < 2 || labels.some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) {
    return invalid("Enter a valid email address.")
  }
  const suggestionDomain = COMMON_DOMAIN_TYPOS[domain] || ""
  if (suggestionDomain) {
    const suggestion = `${local}@${suggestionDomain}`
    return invalid(`Check the email domain. Did you mean ${suggestion}?`, suggestion)
  }
  const tld = labels.at(-1) || ""
  if ((!/^([a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i.test(tld)) || IMPOSSIBLE_TLD_TYPOS.has(tld)) {
    return invalid("Check the ending of the email address, such as .com, .org, or .ng.")
  }
  return { email, valid: true, error: "", suggestion: "" }
}

export function normalizePaymentEmail(value: unknown) {
  return validatePaymentEmail(value).email
}

export function normalizeStudentAccountEmail(
  value: unknown,
  options?: { allowInternalFamilyLearner?: boolean }
) {
  const publicEmail = normalizePaymentEmail(value)
  if (publicEmail) return publicEmail

  const email = String(value || "").trim().toLowerCase()
  if (options?.allowInternalFamilyLearner && INTERNAL_FAMILY_LEARNER_EMAIL.test(email)) {
    return email
  }
  return ""
}

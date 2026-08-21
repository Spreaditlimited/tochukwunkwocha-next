export const STUDENT_PORTFOLIO_REVIEW_STATUSES = ["pending", "approved", "rejected"] as const

export const STUDENT_OPPORTUNITY_TYPES = [
  { value: "freelance", label: "Freelance projects" },
  { value: "internship", label: "Internships" },
  { value: "employment", label: "Employment" },
  { value: "collaboration", label: "Collaborations" }
] as const

export type StudentOpportunityType = (typeof STUDENT_OPPORTUNITY_TYPES)[number]["value"]

export function cleanPortfolioText(value: unknown, max = 500) {
  return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, max)
}

export function slugifyPortfolioName(value: unknown) {
  return cleanPortfolioText(value, 180)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "student"
}

export function studentPortfolioSlug(name: unknown, accountUuid: unknown) {
  const suffix = cleanPortfolioText(accountUuid, 64).replace(/[^a-z0-9]/gi, "").toLowerCase().slice(-8) || "portfolio"
  return `${slugifyPortfolioName(name)}-${suffix}`.slice(0, 190)
}

export function parsePortfolioList(value: unknown, allowed?: ReadonlySet<string>, limit = 12) {
  let input: unknown[] = []
  if (Array.isArray(value)) input = value
  else if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      input = Array.isArray(parsed) ? parsed : value.split(",")
    } catch {
      input = value.split(",")
    }
  }
  return Array.from(new Set(input
    .map((item) => cleanPortfolioText(item, 80))
    .filter((item) => item && (!allowed || allowed.has(item)))
  )).slice(0, limit)
}

export function portfolioJsonList(value: unknown, allowed?: ReadonlySet<string>, limit = 12) {
  return JSON.stringify(parsePortfolioList(value, allowed, limit))
}

export function isAdultPortfolioAgeBand(value: unknown) {
  return ["18-24", "25-34", "35-44", "45-plus"].includes(cleanPortfolioText(value, 40).toLowerCase())
}

export function safeJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

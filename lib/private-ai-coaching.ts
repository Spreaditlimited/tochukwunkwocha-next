export type CoachingCountry = "NG" | "GB" | "US" | "IE" | "CA" | "OTHER"

export type CoachingPlan = {
  key: "foundation" | "build" | "intensive"
  name: string
  badge?: string
  popular?: boolean
  monthlyHours: number
  summary: string
  minimumTerm: string
  outcome: string
  benefits: string[]
}

export const coachingCountries: Array<{ value: CoachingCountry; label: string }> = [
  { value: "NG", label: "Nigeria" },
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "IE", label: "Ireland" },
  { value: "CA", label: "Canada" },
  { value: "OTHER", label: "Other" }
]

export const coachingPlans: CoachingPlan[] = [
  {
    key: "foundation",
    name: "Foundation",
    monthlyHours: 4,
    summary: "For students who need structure, clarity, and steady weekly direction.",
    minimumTerm: "Realistic minimum for complete beginners: 3 months",
    outcome: "Leave with a clear project plan, a working first version, and the confidence to keep building.",
    benefits: [
      "Immediate access to the Advanced class lessons",
      "1 private coaching session per week",
      "Project idea review and narrowing",
      "Build roadmap with tools, priorities, and next steps",
      "Prompt review and correction during sessions",
      "Light debugging and weekly action plan"
    ]
  },
  {
    key: "build",
    name: "Build",
    badge: "Most popular",
    popular: true,
    monthlyHours: 8,
    summary: "The best fit if you want guided execution toward a working MVP.",
    minimumTerm: "Realistic minimum for complete beginners: 2 to 3 months",
    outcome: "Leave with a usable MVP or live version of your tool, plus a clear improvement plan.",
    benefits: [
      "Everything in Foundation",
      "Immediate access to the Advanced class lessons",
      "Hands-on support while you build core pages and flows",
      "Deeper debugging for prompts, screens, and integrations",
      "Midweek async check-in or review",
      "Deployment guidance and simple launch checklist"
    ]
  },
  {
    key: "intensive",
    name: "Intensive",
    monthlyHours: 12,
    summary: "For serious projects that need closer review, faster feedback, and launch polish.",
    minimumTerm: "Realistic minimum for complete beginners: 1 to 2 months",
    outcome: "Leave with a launched or launch-ready tool and a focused roadmap for the next version.",
    benefits: [
      "Everything in Build",
      "Immediate access to the Advanced class lessons",
      "Higher-touch review between sessions",
      "More detailed build architecture and planning support",
      "Priority help when you get stuck",
      "Final polish session and post-launch improvement roadmap"
    ]
  }
]

export function currencyForCountry(country: string) {
  const code = country.toUpperCase()
  if (code === "NG") return "NGN"
  if (code === "US") return "USD"
  if (code === "IE") return "EUR"
  return "GBP"
}

export function formatMinorAmount(minor: number, currency: string) {
  const locale = currency === "NGN" ? "en-NG" : currency === "USD" ? "en-US" : "en-GB"

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2
  }).format(minor / 100)
}

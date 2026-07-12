import { Bot, BriefcaseBusiness, ClipboardCheck, Code2, GraduationCap, School } from "lucide-react"

export const publicStats = [
  { label: "Primary path", value: "Prompt to Profit" },
  { label: "Learning style", value: "Project-based" },
  { label: "Audience", value: "Students, schools, teams" }
] as const

export const audienceTracks = [
  {
    title: "Students and early builders",
    description: "Learn how to use AI tools, prompts, and workflows to produce useful projects.",
    icon: GraduationCap
  },
  {
    title: "Schools and learning teams",
    description: "Bring structured AI literacy into classrooms, clubs, and digital-skills programmes.",
    icon: School
  },
  {
    title: "Business owners and professionals",
    description: "Apply AI to content, operations, customer workflows, and practical business output.",
    icon: BriefcaseBusiness
  }
] as const

export const courses = [
  {
    slug: "prompt-to-profit",
    title: "Prompt to Profit",
    eyebrow: "Core course",
    description:
      "A practical, beginner-friendly programme that teaches you how to work with AI to build websites, software, business tools, and real digital solutions.",
    outcome: "Build confidence with AI-assisted execution and practical project delivery.",
    href: "/courses/prompt-to-profit",
    checkoutHref: "/checkout/prompt-to-profit",
    checkoutCourseSlug: "prompt-to-profit-holiday",
    legacyHref: "/enrol-prompt-to-profit",
    logo: "/brand/prompt-to-profit-logo.webp",
    status: "Enrolling",
    price: "Pricing confirmed at checkout",
    audience: "Beginners, students, parents, entrepreneurs, and early builders",
    duration: "Project-based cohort",
    includes: [
      "Beginner-friendly AI workflow training",
      "Practical website and digital project exercises",
      "Student dashboard access after enrolment",
      "Project-based learning path and certificate rules"
    ],
    checkoutNotes: [
      "Paystack/card payment and bank transfer are supported in the legacy flow.",
      "Manual bank transfers require proof upload and admin verification.",
      "Batch/cohort selection will be wired to the existing course batch tables in the payment integration step."
    ]
  },
  {
    slug: "prompt-to-production",
    title: "Prompt to Profit Advanced",
    eyebrow: "Advanced course",
    description:
      "A structured advanced programme for building production-ready web and mobile applications with AI, professional tools, databases, authentication, payments, and deployment.",
    outcome: "Build a complete Expense Tracker application for web and mobile while learning the workflow used by modern software teams.",
    href: "/courses/prompt-to-production",
    checkoutHref: "/checkout/prompt-to-production",
    checkoutCourseSlug: "prompt-to-production",
    legacyHref: "/enrol-prompt-to-production",
    logo: "/brand/prompt-to-profit-logo.webp",
    status: "Applications open",
    price: "Pricing confirmed at checkout",
    audience: "Prompt to Profit Basic graduates and learners with equivalent AI-assisted building experience",
    duration: "4-week advanced cohort",
    includes: [
      "Professional development environment setup",
      "Web application build with Next.js",
      "Database integration and secure authentication",
      "Mobile application build workflow",
      "Payment gateway integration",
      "Testing, deployment, certificate, and one full year of access"
    ],
    checkoutNotes: [
      "Checkout replaces the old enrolment page but preserves its course slug.",
      "Payment provider wiring will reuse the existing create-order/manual-payment patterns.",
      "International checkout support will be handled during payment integration."
    ]
  },
  {
    slug: "ai-for-everyday-business-owners",
    title: "AI for Everyday Business Owners",
    eyebrow: "Business course",
    description:
      "A practical AI adoption path for owners who want to save time, improve decisions, and build useful business assets.",
    outcome: "Use AI to create repeatable workflows for marketing, planning, customer support, and delivery.",
    href: "/courses/ai-for-everyday-business-owners",
    checkoutHref: "/checkout/ai-for-everyday-business-owners",
    checkoutCourseSlug: "ai-for-everyday-business-owners",
    legacyHref: "/enrol-ai-for-everyday-business-owners",
    logo: null,
    status: "Business path",
    price: "Pricing confirmed at checkout",
    audience: "Business owners and operators adopting AI for daily work",
    duration: "Self-paced or cohort-based",
    includes: [
      "Business-focused AI use cases",
      "Prompting for operations, planning, content, and customer workflows",
      "Practical templates and examples",
      "Student dashboard access after enrolment"
    ],
    checkoutNotes: [
      "Designed as a course product in the new checkout model.",
      "Payment configuration will be attached during backend payment migration.",
      "Manual verification can reuse the existing manual payment table."
    ]
  },
  {
    slug: "prompt-to-profit-schools",
    title: "Prompt to Profit for Schools",
    eyebrow: "Schools programme",
    description:
      "A practical AI learning programme for schools that want students to learn by building real digital projects.",
    outcome: "Bring structured, safe, project-based AI education into school environments.",
    href: "/courses/prompt-to-profit-schools",
    checkoutHref: "/checkout/prompt-to-profit-schools",
    checkoutCourseSlug: "prompt-to-profit-schools",
    legacyHref: "/enrol-prompt-to-profit-schools",
    logo: "/brand/prompt-to-profit-logo.webp",
    status: "School enquiries",
    price: "School pricing confirmed after enquiry",
    audience: "School owners, administrators, teachers, and student cohorts",
    duration: "School implementation programme",
    includes: [
      "School-friendly AI learning structure",
      "Student access and progress management model",
      "Project-based outcomes",
      "Admin review and onboarding workflow"
    ],
    checkoutNotes: [
      "Schools typically require enquiry and onboarding before payment.",
      "This checkout page acts as the product route while school payment logic is migrated.",
      "School-specific access code flows remain separate from individual checkout."
    ]
  }
] as const

export type Course = (typeof courses)[number]

export const courseAliases = {
  "prompt-to-profit-advanced": "prompt-to-production",
  "prompt-to-profit-holiday": "prompt-to-profit",
  "prompt-to-profit-job-seekers": "prompt-to-profit",
  "prompt-to-profit-children": "prompt-to-profit"
} as const

export function resolveCourseSlug(slug: string): string {
  return courseAliases[slug as keyof typeof courseAliases] || slug
}

export function resolveCheckoutCourseSlug(course: Course): string {
  return course.checkoutCourseSlug
}

export const services = [
  {
    slug: "business-plan",
    title: "AI Business Plan Service",
    eyebrow: "Done-with-you planning",
    description:
      "A guided service for turning business ideas into clearer plans, operating assumptions, and next-step documents.",
    outcome: "Clarify the offer, audience, model, and execution path before investing more time or money.",
    href: "/services/business-plan",
    icon: ClipboardCheck
  },
  {
    slug: "domain-registration",
    title: "Domain Registration",
    eyebrow: "Digital presence",
    description:
      "A route foundation for moving the existing domain registration service into the Next.js application.",
    outcome: "Keep service requests inside the same app shell as student, admin, and future payment flows.",
    href: "/services/domain-registration",
    icon: Code2
  },
  {
    slug: "lead-capture",
    title: "Lead Capture",
    eyebrow: "Funnels and pages",
    description:
      "A route foundation for the existing lead page and lead capture workflow migration.",
    outcome: "Centralize lead capture pages, tracking, and admin review in one stack.",
    href: "/services/lead-capture",
    icon: Bot
  }
] as const

export const migrationPages = [
  {
    href: "/build-scorecard",
    title: "Build Scorecard",
    description: "Qualify project fit before a build implementation engagement."
  },
  {
    href: "/private-ai-build-coaching",
    title: "Private AI Build Coaching",
    description: "Guided implementation for people who want to build and understand their own tool."
  },
  {
    href: "/contact",
    title: "Contact",
    description: "A clean Next.js route for enquiry capture and future server actions."
  }
] as const

export function getCourse(slug: string) {
  const canonicalSlug = resolveCourseSlug(slug)
  return courses.find((course) => course.slug === canonicalSlug)
}

export function getService(slug: string) {
  return services.find((service) => service.slug === slug)
}

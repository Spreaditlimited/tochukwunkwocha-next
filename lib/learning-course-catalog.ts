import { Prisma } from "@prisma/client"

export const configuredLearningCourses = [
  {
    slug: "prompt-to-profit",
    title: "Prompt to Profit"
  },
  {
    slug: "prompt-to-production",
    title: "Prompt to Profit Advanced"
  },
  {
    slug: "prompt-to-profit-schools",
    title: "Prompt to Profit for Schools"
  },
  {
    slug: "ai-for-everyday-business-owners",
    title: "AI for Everyday Business Owners"
  },
  {
    slug: "prompt-to-profit-holiday",
    title: "Prompt to Profit Holiday"
  }
] as const

export const configuredLearningCourseSlugs = configuredLearningCourses.map((course) => course.slug)

export const dayLevelCourseSlugRegex = "(^|-)day-(one|two|three|four|five|six|seven|eight|nine|ten|[0-9]+)$"

export function configuredLearningCourseSlugSql() {
  return Prisma.join(configuredLearningCourseSlugs)
}

export function isListableLearningCourseSlug(value: unknown) {
  const slug = String(value || "").trim().toLowerCase()
  if (!slug) return false
  return !new RegExp(dayLevelCourseSlugRegex).test(slug)
}

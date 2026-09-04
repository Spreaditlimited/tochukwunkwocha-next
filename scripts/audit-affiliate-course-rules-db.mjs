import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

try {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT course_slug AS courseSlug,
           is_affiliate_eligible AS isAffiliateEligible,
           commission_type AS commissionType,
           commission_value AS commissionValue,
           commission_currency AS commissionCurrency
    FROM tochukwu_affiliate_course_rules
    WHERE course_slug IN ('prompt-to-profit', 'prompt-to-profit-holiday', 'prompt-to-production')
    ORDER BY course_slug ASC
  `)

  console.log(rows.map((row) => ({
    courseSlug: row.courseSlug,
    isAffiliateEligible: Boolean(Number(row.isAffiliateEligible)),
    commissionType: row.commissionType,
    commissionValue: Number(row.commissionValue),
    commissionCurrency: row.commissionCurrency
  })))
} finally {
  await prisma.$disconnect()
}

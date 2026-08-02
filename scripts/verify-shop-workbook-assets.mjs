import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const expectedSkus = [
  "PTP-WB01-DIG",
  "PTP-WB02-DIG",
  "PTP-WB03-DIG",
  "PTP-WB04-DIG",
  "PTP-WB05-DIG",
  "PTP-WB06-DIG",
  "PTP-WB07-DIG",
  "PTP-WB08-DIG"
]
const expectedPrices = new Map([
  ["NGN", 1_000_000],
  ["USD", 2_000],
  ["GBP", 2_000],
  ["EUR", 2_000]
])

try {
  const variants = await prisma.shopProductVariant.findMany({
    where: { sku: { in: expectedSkus } },
    include: {
      prices: { orderBy: { currency: "asc" } },
      product: true
    },
    orderBy: { sku: "asc" }
  })
  if (variants.length !== expectedSkus.length) {
    throw new Error(`Expected ${expectedSkus.length} workbook variants but found ${variants.length}.`)
  }
  for (const variant of variants) {
    const product = variant.product
    const faqs = JSON.parse(product.faqJson || "[]")
    if (
      product.status !== "published" ||
      !product.publishedAt ||
      !product.seoTitle ||
      !product.seoDescription ||
      !product.coverImageUrl ||
      !product.bodyContent ||
      product.bodyContent.length < 2_000 ||
      !Array.isArray(faqs) ||
      faqs.length < 5
    ) {
      throw new Error(`${variant.sku} does not have a complete published SEO record.`)
    }
    if (variant.prices.length !== expectedPrices.size) {
      throw new Error(`${variant.sku} does not have all four currency prices.`)
    }
    for (const [currency, amountMinor] of expectedPrices) {
      const price = variant.prices.find((entry) => entry.currency === currency)
      if (!price?.active || price.amountMinor !== amountMinor) {
        throw new Error(`${variant.sku} has an incorrect ${currency} price.`)
      }
    }
    if (
      !variant.cloudinaryPublicId ||
      variant.cloudinaryResourceType !== "raw" ||
      variant.cloudinaryDeliveryType !== "authenticated" ||
      variant.cloudinaryFormat !== "pdf" ||
      !variant.cloudinaryBytes ||
      variant.digitalAssetKey
    ) {
      throw new Error(`${variant.sku} does not have a complete protected Cloudinary record.`)
    }
    console.log(
      `${variant.sku}: published, four prices, detailed SEO, authenticated PDF (${variant.cloudinaryBytes} bytes)`
    )
  }
} finally {
  await prisma.$disconnect()
}

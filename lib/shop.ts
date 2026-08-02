import crypto from "crypto"
import path from "path"

import { Prisma } from "@prisma/client"

import { getAdminSettingValue } from "@/lib/admin-settings"
import { sendEmail } from "@/lib/email"
import {
  getConfiguredStripeFee,
  grossUpPaystackAmount,
  grossUpStripeAmount
} from "@/lib/payments/processing-fees"
import { prisma } from "@/lib/prisma"
import { absoluteUrl } from "@/lib/site-seo"
import { createShopDownloadToken } from "@/lib/shop-download-token"
export { formatShopMoney } from "@/lib/shop-format"

export const SHOP_PAYMENT_SCOPE = "shop_order"

export type ShopFaq = {
  question: string
  answer: string
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function normalizedEmail(value: unknown) {
  const email = clean(value, 190).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}

function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function shopFaqs(value: string | null | undefined) {
  return safeJson<ShopFaq[]>(value, []).filter(
    (item) => clean(item?.question, 300) && clean(item?.answer, 2000)
  )
}

function publicShopProductStatus(): Prisma.ShopProductWhereInput {
  return process.env.NODE_ENV === "development"
    ? { status: { in: ["published", "draft"] } }
    : { status: "published" }
}

export async function listPublishedShopProducts() {
  try {
    return await prisma.shopProduct.findMany({
      where: publicShopProductStatus(),
      include: {
        variants: {
          where: { active: true },
          include: { prices: { where: { active: true }, orderBy: { currency: "asc" } } },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
        }
      },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { publishedAt: "desc" }]
    })
  } catch (error) {
    console.warn("shop_catalog_unavailable", error instanceof Error ? error.message : error)
    return []
  }
}

export async function getPublishedShopProduct(slug: string) {
  try {
    return await prisma.shopProduct.findFirst({
      where: { slug: clean(slug, 190), ...publicShopProductStatus() },
      include: {
        variants: {
          where: { active: true },
          include: { prices: { where: { active: true }, orderBy: { currency: "asc" } } },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
        }
      }
    })
  } catch (error) {
    console.warn("shop_product_unavailable", error instanceof Error ? error.message : error)
    return null
  }
}

export async function getPublishedShopVariant(variantUuid: string) {
  try {
    return await prisma.shopProductVariant.findFirst({
      where: {
        variantUuid: clean(variantUuid, 64),
        active: true,
        product: { status: "published" }
      },
      include: {
        product: true,
        prices: { where: { active: true }, orderBy: { currency: "asc" } }
      }
    })
  } catch (error) {
    console.warn("shop_variant_unavailable", error instanceof Error ? error.message : error)
    return null
  }
}

export async function listAdminShopProducts() {
  return prisma.shopProduct.findMany({
    include: {
      variants: {
        include: { prices: { orderBy: { currency: "asc" } } },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
      }
    },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }]
  })
}

export async function listAdminShopOrders() {
  return prisma.shopOrder.findMany({
    include: { items: true, shipment: true },
    orderBy: { createdAt: "desc" },
    take: 200
  })
}

export async function listStudentShopOrders(accountId: bigint, email: string) {
  const normalized = normalizedEmail(email)
  return prisma.shopOrder.findMany({
    where: {
      paymentStatus: "paid",
      OR: [{ studentAccountId: accountId }, { customerEmail: normalized }]
    },
    include: {
      items: true,
      shipment: true,
      entitlements: { include: { variant: true } }
    },
    orderBy: { createdAt: "desc" }
  })
}

function orderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  return `TT-${date}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`
}

function nigeriaCountry(value: string) {
  const country = value.trim().toLowerCase()
  return country === "nigeria" || country === "ng"
}

type ShopPriceSource = {
  priceMinor: number
  currency: string
  prices?: Array<{ currency: string; amountMinor: number; active: boolean }>
}

function priceForCurrency(variant: ShopPriceSource, currencyInput: string) {
  const currency = clean(currencyInput, 12).toUpperCase()
  const configured = variant.prices?.find(
    (price) => price.active && price.currency.toUpperCase() === currency
  )
  if (configured) return { currency, amountMinor: configured.amountMinor }
  if (variant.currency.toUpperCase() === currency && variant.priceMinor > 0) {
    return { currency, amountMinor: variant.priceMinor }
  }
  return null
}

async function configuredVatPercent(provider: "paystack" | "stripe") {
  const key = provider === "paystack" ? "SITE_VAT_PERCENT" : "INTL_VAT_PERCENT"
  const raw = Number(await getAdminSettingValue(key))
  return Number.isFinite(raw) && raw >= 0
    ? Math.min(raw, 100)
    : provider === "paystack"
      ? 7.5
      : 20
}

export async function calculateShopPricing(input: {
  variant: ShopPriceSource
  currency: string
  quantity?: number
  shippingMinor?: number
}) {
  const price = priceForCurrency(input.variant, input.currency)
  if (!price || price.amountMinor <= 0) throw new Error("This currency is not available.")
  const quantity = Math.max(1, Math.min(10, Math.trunc(Number(input.quantity) || 1)))
  const provider = price.currency === "NGN" ? "paystack" as const : "stripe" as const
  const subtotalMinor = price.amountMinor * quantity
  const vatPercent = await configuredVatPercent(provider)
  const vatMinor = Math.round((subtotalMinor * vatPercent) / 100)
  const shippingMinor = Math.max(0, Math.round(Number(input.shippingMinor || 0)))
  const beforeProcessingMinor = subtotalMinor + vatMinor + shippingMinor
  const totalMinor =
    provider === "paystack"
      ? grossUpPaystackAmount(beforeProcessingMinor)
      : await (async () => {
          const fee = await getConfiguredStripeFee(price.currency)
          return grossUpStripeAmount(beforeProcessingMinor, fee.bps, fee.fixedMinor)
        })()
  return {
    provider,
    currency: price.currency,
    unitPriceMinor: price.amountMinor,
    quantity,
    subtotalMinor,
    vatPercent,
    vatMinor,
    shippingMinor,
    processingFeeMinor: Math.max(0, totalMinor - beforeProcessingMinor),
    totalMinor
  }
}

export async function createPendingShopOrder(input: {
  variantUuid: string
  currency: string
  quantity: number
  customerName: string
  customerEmail: string
  customerPhone?: string
  customerCountry?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  postalCode?: string
  studentAccountId?: bigint | null
}) {
  const customerName = clean(input.customerName, 180)
  const customerEmail = normalizedEmail(input.customerEmail)
  const quantity = Math.max(1, Math.min(10, Math.trunc(Number(input.quantity) || 1)))
  if (!customerName) throw new Error("Enter your full name.")
  if (!customerEmail) throw new Error("Enter a valid email address.")

  const variant = await prisma.shopProductVariant.findFirst({
    where: {
      variantUuid: clean(input.variantUuid, 64),
      active: true,
      product: { status: "published" }
    },
    include: {
      product: true,
      prices: { where: { active: true }, orderBy: { currency: "asc" } }
    }
  })
  if (!variant) throw new Error("This product option is no longer available.")
  if (
    variant.fulfillmentType === "physical" &&
    variant.inventoryPolicy === "deny" &&
    variant.stockQuantity !== null &&
    variant.stockQuantity < quantity
  ) {
    throw new Error("There is not enough stock for the quantity selected.")
  }

  const physical = variant.fulfillmentType === "physical"
  const country = clean(input.customerCountry, 100)
  const addressLine1 = clean(input.addressLine1, 255)
  const city = clean(input.city, 120)
  const state = clean(input.state, 120)
  if (physical && (!country || !addressLine1 || !city || !state)) {
    throw new Error("Enter the delivery address for this merchandise order.")
  }
  if (physical && !nigeriaCountry(country)) {
    throw new Error("Physical merchandise is currently available for delivery within Nigeria.")
  }

  const configuredShipping = Math.max(
    0,
    Number.parseInt(process.env.SHOP_NIGERIA_SHIPPING_MINOR || "0", 10) || 0
  )
  const shippingMinor = physical ? configuredShipping : 0
  const pricing = await calculateShopPricing({
    variant,
    currency: clean(input.currency, 12) || variant.currency,
    quantity,
    shippingMinor
  })
  const orderUuid = crypto.randomUUID()
  const now = new Date()
  const shippingAddressJson = physical
    ? JSON.stringify({
        addressLine1,
        addressLine2: clean(input.addressLine2, 255),
        city,
        state,
        postalCode: clean(input.postalCode, 40),
        country
      })
    : null

  const order = await prisma.shopOrder.create({
    data: {
      orderUuid,
      orderNumber: orderNumber(),
      studentAccountId: input.studentAccountId || null,
      customerName,
      customerEmail,
      customerPhone: clean(input.customerPhone, 40) || null,
      customerCountry: country || null,
      currency: pricing.currency,
      subtotalMinor: pricing.subtotalMinor,
      shippingMinor: pricing.shippingMinor,
      taxMinor: pricing.vatMinor,
      processingFeeMinor: pricing.processingFeeMinor,
      totalMinor: pricing.totalMinor,
      paymentProvider: pricing.provider,
      paymentStatus: "pending",
      fulfillmentStatus: "unfulfilled",
      shippingAddressJson,
      createdAt: now,
      updatedAt: now,
      items: {
        create: {
          itemUuid: crypto.randomUUID(),
          productId: variant.productId,
          variantId: variant.id,
          productTitleSnapshot: variant.product.title,
          productSlugSnapshot: variant.product.slug,
          variantTitleSnapshot: variant.title,
          skuSnapshot: variant.sku,
          fulfillmentTypeSnapshot: variant.fulfillmentType,
          unitPriceMinor: pricing.unitPriceMinor,
          quantity,
          lineTotalMinor: pricing.subtotalMinor,
          createdAt: now
        }
      }
    },
    include: { items: true }
  })
  return { order, variant, product: variant.product }
}

export async function recordShopProviderReference(input: {
  orderUuid: string
  providerReference: string
  providerOrderId?: string | null
}) {
  return prisma.shopOrder.update({
    where: { orderUuid: input.orderUuid },
    data: {
      providerReference: clean(input.providerReference, 190),
      providerOrderId: clean(input.providerOrderId, 190) || null
    }
  })
}

export async function fulfillPaidShopOrder(input: {
  orderUuid: string
  providerReference: string
  providerOrderId?: string | null
  paidAmountMinor?: number | null
  paidCurrency?: string | null
}) {
  const order = await prisma.shopOrder.findUnique({
    where: { orderUuid: clean(input.orderUuid, 64) },
    include: { items: true }
  })
  if (!order) throw new Error("Shop order not found.")
  if (
    input.paidAmountMinor !== null &&
    input.paidAmountMinor !== undefined &&
    Number(input.paidAmountMinor) !== order.totalMinor
  ) {
    throw new Error("The paid amount does not match the shop order.")
  }
  if (
    input.paidCurrency &&
    input.paidCurrency.toUpperCase() !== order.currency.toUpperCase()
  ) {
    throw new Error("The paid currency does not match the shop order.")
  }
  if (order.paymentStatus === "paid") return order

  const hasPhysical = order.items.some((item) => item.fulfillmentTypeSnapshot === "physical")
  const now = new Date()
  await prisma.$transaction(async (transaction) => {
    const claimed = await transaction.shopOrder.updateMany({
      where: { id: order.id, paymentStatus: { not: "paid" } },
      data: {
        paymentStatus: "paid",
        providerReference: clean(input.providerReference, 190),
        providerOrderId: clean(input.providerOrderId, 190) || null,
        paidAt: now,
        fulfillmentStatus: hasPhysical ? "processing" : "fulfilled",
        updatedAt: now
      }
    })
    if (!claimed.count) return

    for (const item of order.items) {
      if (item.fulfillmentTypeSnapshot === "digital") {
        await transaction.shopDigitalEntitlement.upsert({
          where: {
            orderItemId_recipientEmail: {
              orderItemId: item.id,
              recipientEmail: order.customerEmail
            }
          },
          create: {
            entitlementUuid: crypto.randomUUID(),
            orderId: order.id,
            orderItemId: item.id,
            variantId: item.variantId,
            recipientEmail: order.customerEmail,
            createdAt: now,
            updatedAt: now
          },
          update: { status: "active", updatedAt: now }
        })
      } else if (item.variantId) {
        await transaction.shopProductVariant.updateMany({
          where: {
            id: item.variantId,
            inventoryPolicy: "deny",
            stockQuantity: { not: null, gte: item.quantity }
          },
          data: { stockQuantity: { decrement: item.quantity } }
        })
      }
    }

    if (hasPhysical) {
      await transaction.shopShipment.upsert({
        where: { orderId: order.id },
        create: {
          shipmentUuid: crypto.randomUUID(),
          orderId: order.id,
          status: "processing",
          createdAt: now,
          updatedAt: now
        },
        update: { updatedAt: now }
      })
    }
  })

  const refreshed = await prisma.shopOrder.findUnique({
    where: { id: order.id },
    include: { items: true, entitlements: true }
  })
  if (refreshed) {
    const purchasesUrl = absoluteUrl("/dashboard/purchases")
    const downloadLinks = refreshed.entitlements
      .map((entitlement) => {
        const token = createShopDownloadToken({
          entitlementUuid: entitlement.entitlementUuid,
          email: refreshed.customerEmail
        })
        const href = absoluteUrl(
          `/api/shop/download/${encodeURIComponent(entitlement.entitlementUuid)}?token=${encodeURIComponent(token)}`
        )
        return `<li><a href="${href}">Download your digital workbook</a></li>`
      })
      .join("")
    await sendEmail({
      to: refreshed.customerEmail,
      subject: `Order confirmed: ${refreshed.orderNumber}`,
      html: `<p>Thank you, ${escapeHtml(refreshed.customerName)}.</p>
        <p>Your payment has been confirmed for order <strong>${escapeHtml(refreshed.orderNumber)}</strong>.</p>
        ${
          refreshed.entitlements.length
            ? `<p>Your digital workbook is ready:</p><ul>${downloadLinks}</ul><p>You can also find purchases linked to your student email in <a href="${purchasesUrl}">My Purchases</a>.</p>`
            : "<p>Your merchandise order is now being prepared for delivery.</p>"
        }`
    }).catch(() => null)
  }
  return refreshed
}

export async function getTokenDownloadableEntitlement(input: {
  entitlementUuid: string
  email: string
}) {
  const entitlement = await prisma.shopDigitalEntitlement.findFirst({
    where: {
      entitlementUuid: clean(input.entitlementUuid, 64),
      recipientEmail: normalizedEmail(input.email),
      status: "active",
      order: { paymentStatus: "paid" }
    },
    include: { variant: true, orderItem: true }
  })
  if (
    !entitlement?.variant ||
    (!entitlement.variant.cloudinaryPublicId && !entitlement.variant.digitalAssetKey)
  ) return null
  return entitlement
}

export async function getShopOrderConfirmation(orderUuid: string, email?: string) {
  const normalized = normalizedEmail(email)
  return prisma.shopOrder.findFirst({
    where: {
      orderUuid: clean(orderUuid, 64),
      ...(normalized ? { customerEmail: normalized } : {})
    },
    include: { items: true, shipment: true }
  })
}

export async function getDownloadableEntitlement(input: {
  entitlementUuid: string
  accountId: bigint
  email: string
}) {
  const entitlement = await prisma.shopDigitalEntitlement.findFirst({
    where: {
      entitlementUuid: clean(input.entitlementUuid, 64),
      status: "active",
      order: {
        paymentStatus: "paid",
        OR: [
          { studentAccountId: input.accountId },
          { customerEmail: normalizedEmail(input.email) }
        ]
      }
    },
    include: { variant: true, orderItem: true }
  })
  if (
    !entitlement?.variant ||
    (!entitlement.variant.cloudinaryPublicId && !entitlement.variant.digitalAssetKey)
  ) return null
  return entitlement
}

export function resolveShopDigitalAsset(assetKey: string) {
  const repositoryRoot = process.cwd()
  const relative = clean(assetKey, 1000).replace(/^\/+/, "")
  if (!relative.startsWith("deliverables/")) return null
  const resolved = path.resolve(repositoryRoot, relative)
  const deliverablesRoot = path.resolve(repositoryRoot, "deliverables")
  if (!resolved.startsWith(`${deliverablesRoot}${path.sep}`)) return null
  return resolved
}

export async function recordShopDownload(entitlementUuid: string) {
  await prisma.shopDigitalEntitlement.update({
    where: { entitlementUuid },
    data: { downloadCount: { increment: 1 }, lastDownloadAt: new Date() }
  })
}

export async function upsertShopProductFromForm(formData: FormData) {
  const productUuid = clean(formData.get("productUuid"), 64) || crypto.randomUUID()
  const title = clean(formData.get("title"), 255)
  const slug = clean(formData.get("slug"), 190)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  const shortDescription = clean(formData.get("shortDescription"), 5000)
  if (!title || !slug || !shortDescription) {
    throw new Error("Title, slug and short description are required.")
  }
  const status = clean(formData.get("status"), 30) === "published" ? "published" : "draft"
  const existing = await prisma.shopProduct.findUnique({ where: { productUuid } })
  const data: Prisma.ShopProductUncheckedCreateInput = {
    productUuid,
    title,
    slug,
    subtitle: clean(formData.get("subtitle"), 255) || null,
    shortDescription,
    bodyContent: clean(formData.get("bodyContent"), 100000) || null,
    coverImageUrl: clean(formData.get("coverImageUrl"), 2000) || null,
    category: clean(formData.get("category"), 80) || "workbooks",
    status,
    featured: formData.get("featured") === "on",
    seoTitle: clean(formData.get("seoTitle"), 255) || null,
    seoDescription: clean(formData.get("seoDescription"), 500) || null,
    faqJson: clean(formData.get("faqJson"), 20000) || null,
    sortOrder: Number.parseInt(clean(formData.get("sortOrder"), 12), 10) || 0,
    publishedAt: status === "published" ? existing?.publishedAt || new Date() : null,
    createdAt: existing?.createdAt || new Date(),
    updatedAt: new Date()
  }
  return prisma.shopProduct.upsert({
    where: { productUuid },
    create: data,
    update: data
  })
}

export async function upsertShopVariantFromForm(formData: FormData) {
  const productUuid = clean(formData.get("productUuid"), 64)
  const product = await prisma.shopProduct.findUnique({ where: { productUuid } })
  if (!product) throw new Error("Choose a valid shop product.")
  const variantUuid = clean(formData.get("variantUuid"), 64) || crypto.randomUUID()
  const title = clean(formData.get("variantTitle"), 160)
  const sku = clean(formData.get("sku"), 100).toUpperCase().replace(/[^A-Z0-9_-]/g, "")
  const priceMinor = Math.max(0, Math.round(Number(formData.get("priceMajor") || 0) * 100))
  if (!title || !sku) throw new Error("Variant title and SKU are required.")
  const currency = clean(formData.get("currency"), 12).toUpperCase() || "NGN"
  if (!["NGN", "USD", "GBP", "EUR"].includes(currency)) {
    throw new Error("Choose NGN, USD, GBP or EUR.")
  }
  const fulfillmentType =
    clean(formData.get("fulfillmentType"), 20) === "physical" ? "physical" : "digital"
  const stockInput = clean(formData.get("stockQuantity"), 12)
  const data = {
    productId: product.id,
    title,
    sku,
    fulfillmentType,
    priceMinor,
    currency,
    stockQuantity: stockInput ? Math.max(0, Number.parseInt(stockInput, 10) || 0) : null,
    inventoryPolicy: "deny",
    digitalAssetKey:
      fulfillmentType === "digital"
        ? clean(formData.get("digitalAssetKey"), 2000) || null
        : null,
    digitalFilename:
      fulfillmentType === "digital"
        ? clean(formData.get("digitalFilename"), 255) || null
        : null,
    active: formData.get("active") === "on",
    sortOrder: Number.parseInt(clean(formData.get("variantSortOrder"), 12), 10) || 0,
    updatedAt: new Date()
  }
  return prisma.$transaction(async (transaction) => {
    const variant = await transaction.shopProductVariant.upsert({
      where: { variantUuid },
      create: { variantUuid, ...data, createdAt: new Date() },
      update: data
    })
    await transaction.shopVariantPrice.upsert({
      where: { variantId_currency: { variantId: variant.id, currency } },
      create: {
        priceUuid: crypto.randomUUID(),
        variantId: variant.id,
        currency,
        amountMinor: priceMinor,
        active: data.active,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      update: {
        amountMinor: priceMinor,
        active: data.active,
        updatedAt: new Date()
      }
    })
    return variant
  })
}

export async function updateShopShipmentFromForm(formData: FormData) {
  const orderUuid = clean(formData.get("orderUuid"), 64)
  const order = await prisma.shopOrder.findUnique({
    where: { orderUuid },
    include: { shipment: true }
  })
  if (!order?.shipment) throw new Error("This order does not have a physical shipment.")
  const statusInput = clean(formData.get("shipmentStatus"), 30)
  const status = ["processing", "shipped", "delivered"].includes(statusInput)
    ? statusInput
    : "processing"
  const now = new Date()
  return prisma.$transaction([
    prisma.shopShipment.update({
      where: { id: order.shipment.id },
      data: {
        status,
        carrier: clean(formData.get("carrier"), 120) || null,
        trackingNumber: clean(formData.get("trackingNumber"), 190) || null,
        trackingUrl: clean(formData.get("trackingUrl"), 2000) || null,
        adminNotes: clean(formData.get("adminNotes"), 5000) || null,
        shippedAt:
          status === "shipped" || status === "delivered"
            ? order.shipment.shippedAt || now
            : null,
        deliveredAt: status === "delivered" ? order.shipment.deliveredAt || now : null,
        updatedAt: now
      }
    }),
    prisma.shopOrder.update({
      where: { id: order.id },
      data: {
        fulfillmentStatus:
          status === "delivered" ? "fulfilled" : status,
        updatedAt: now
      }
    })
  ])
}

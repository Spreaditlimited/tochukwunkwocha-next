import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

type PaidOrderSummary = {
  orderUuid: string
  courseSlug: string | null
  currency: string | null
  amountMinor: number | bigint | null
  status: string | null
}

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const orderUuid = String(new URL(request.url).searchParams.get("order_uuid") || "").trim().slice(0, 64)
  if (!orderUuid) {
    return NextResponse.json({ ok: false, error: "Missing order_uuid" }, { status: 400 })
  }

  const rows = await prisma.$queryRaw<PaidOrderSummary[]>`
    SELECT
      order_uuid AS orderUuid,
      course_slug AS courseSlug,
      currency,
      amount_minor AS amountMinor,
      status
    FROM course_orders
    WHERE order_uuid = ${orderUuid}
    ORDER BY id DESC
    LIMIT 1
  `
  const order = rows[0]
  if (!order || String(order.status || "").toLowerCase() !== "paid") {
    return NextResponse.json({ ok: false, error: "Order not paid" }, { status: 404 })
  }

  const value = Number(order.amountMinor || 0) / 100
  return NextResponse.json({
    ok: true,
    order: {
      order_uuid: order.orderUuid,
      course_slug: order.courseSlug,
      currency: String(order.currency || "").toUpperCase(),
      value: Number.isFinite(value) ? Number(value.toFixed(2)) : 0
    }
  })
}

export type AffiliateSeatCommission = {
  seatNumber: number
  seatCount: number
  seatAmountMinor: number
  commissionAmountMinor: number
}

function integer(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : fallback
}

export function buildAffiliateSeatCommissions(input: {
  orderAmountMinor: number
  seatCount: number
  commissionType: string
  commissionValue: number
}): AffiliateSeatCommission[] {
  const orderAmountMinor = Math.max(0, integer(input.orderAmountMinor))
  const seatCount = Math.max(1, Math.min(10000, integer(input.seatCount, 1)))
  const commissionType = String(input.commissionType || "").trim().toLowerCase() === "fixed" ? "fixed" : "percentage"
  const commissionValue = Math.max(0, integer(input.commissionValue))
  const baseSeatAmount = Math.floor(orderAmountMinor / seatCount)
  const remainder = orderAmountMinor % seatCount

  return Array.from({ length: seatCount }, (_unused, index) => {
    const seatNumber = index + 1
    const seatAmountMinor = baseSeatAmount + (seatNumber <= remainder ? 1 : 0)
    const commissionAmountMinor =
      commissionType === "fixed"
        ? commissionValue
        : Math.floor((seatAmountMinor * Math.min(commissionValue, 10000)) / 10000)
    return { seatNumber, seatCount, seatAmountMinor, commissionAmountMinor }
  }).filter((seat) => seat.commissionAmountMinor > 0)
}

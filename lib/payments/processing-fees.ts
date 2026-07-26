import { getAdminSettingValue } from "@/lib/admin-settings"

export async function getConfiguredStripeFee(currencyInput: string) {
  const currency = String(currencyInput || "").trim().toUpperCase()
  const bpsText = await getAdminSettingValue("STRIPE_FEE_BPS")
  const fixedKey = `STRIPE_FEE_FIXED_${currency}_MINOR`
  const fixedText = await getAdminSettingValue(fixedKey)

  if (bpsText === "") throw new Error("Missing Stripe processing-fee setting: STRIPE_FEE_BPS")
  if (fixedText === "") throw new Error(`Missing Stripe processing-fee setting: ${fixedKey}`)

  const bps = Number(bpsText)
  const fixedMinor = Number(fixedText)
  if (!Number.isFinite(bps) || bps < 0 || bps >= 10000) {
    throw new Error("STRIPE_FEE_BPS must be between 0 and 9999 basis points.")
  }
  if (!Number.isFinite(fixedMinor) || fixedMinor < 0) {
    throw new Error(`${fixedKey} must be a non-negative minor-unit amount.`)
  }

  return {
    bps: Math.round(bps),
    fixedMinor: Math.round(fixedMinor)
  }
}

export function grossUpStripeAmount(netMinorInput: number, bpsInput: number, fixedMinorInput: number) {
  const netMinor = Math.max(0, Math.round(Number(netMinorInput || 0)))
  const bps = Math.max(0, Math.min(9999, Math.round(Number(bpsInput || 0))))
  const fixedMinor = Math.max(0, Math.round(Number(fixedMinorInput || 0)))
  const rate = bps / 10000
  const feeAt = (totalMinor: number) => Math.round(totalMinor * rate) + fixedMinor
  let totalMinor = Math.ceil((netMinor + fixedMinor) / (1 - rate))

  while (totalMinor > netMinor && totalMinor - 1 - feeAt(totalMinor - 1) >= netMinor) {
    totalMinor -= 1
  }
  while (totalMinor - feeAt(totalMinor) < netMinor) {
    totalMinor += 1
  }

  return totalMinor
}

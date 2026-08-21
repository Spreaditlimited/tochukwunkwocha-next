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

export function grossUpPaystackAmount(netMinorInput: number) {
  const netMinor = Math.max(0, Math.round(Number(netMinorInput || 0)))
  if (/^(1|true|yes)$/i.test(String(process.env.PAYSTACK_FEES_PASSED_BY_DASHBOARD || ""))) return netMinor
  const numberSetting = (key: string, fallback: number) => {
    const value = Number(process.env[key])
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback
  }
  const bps = Math.min(9999, numberSetting("PAYSTACK_FEE_BPS", 150))
  const fixedMinor = numberSetting("PAYSTACK_FEE_FIXED_NGN_MINOR", 10_000)
  const fixedWaiverBelowMinor = numberSetting("PAYSTACK_FEE_FIXED_WAIVER_BELOW_NGN_MINOR", 250_000)
  const capMinor = numberSetting("PAYSTACK_FEE_CAP_NGN_MINOR", 200_000)
  const feeAt = (totalMinor: number) => Math.min(
    capMinor,
    Math.round((totalMinor * bps) / 10_000) + (totalMinor < fixedWaiverBelowMinor ? 0 : fixedMinor)
  )
  let low = netMinor
  let high = netMinor + capMinor + fixedMinor + 10_000
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (middle - feeAt(middle) >= netMinor) high = middle
    else low = middle + 1
  }
  return low
}

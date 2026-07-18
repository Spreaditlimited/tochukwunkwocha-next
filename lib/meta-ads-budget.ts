import { getAdminSettingValue } from "@/lib/admin-settings"

export const META_ADS_BUDGET_SETTING_KEY = "META_ADS_MAX_DAILY_BUDGET_NGN_MINOR"

export type MetaAdsBudgetPolicy = {
  currency: "NGN"
  maxDailyBudgetMinor: number
}

export async function getMetaAdsBudgetPolicy(): Promise<MetaAdsBudgetPolicy | null> {
  const raw = String(await getAdminSettingValue(META_ADS_BUDGET_SETTING_KEY)).trim()
  if (!/^\d+$/.test(raw)) return null
  const maxDailyBudgetMinor = Number(raw)
  if (!Number.isSafeInteger(maxDailyBudgetMinor) || maxDailyBudgetMinor <= 0) return null
  return { currency: "NGN", maxDailyBudgetMinor }
}

export async function assertMetaAdsDailyBudget(requestedMinor: number) {
  if (!Number.isSafeInteger(requestedMinor) || requestedMinor <= 0) {
    throw new Error("The requested Meta Ads daily budget is invalid.")
  }
  const policy = await getMetaAdsBudgetPolicy()
  if (!policy) {
    throw new Error(`Meta Ads publishing is locked because ${META_ADS_BUDGET_SETTING_KEY} is not configured.`)
  }
  if (requestedMinor > policy.maxDailyBudgetMinor) {
    throw new Error("The requested Meta Ads daily budget exceeds the configured hard limit.")
  }
  return policy
}

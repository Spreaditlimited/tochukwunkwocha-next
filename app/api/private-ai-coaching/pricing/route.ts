import { NextRequest, NextResponse } from "next/server"

import { getAdminSettingValue } from "@/lib/admin-settings"
import { coachingPlans, currencyForCountry, formatMinorAmount, type CoachingPlan } from "@/lib/private-ai-coaching"
import { serviceCheckoutPricing } from "@/lib/payments/service-checkout"

function clean(value: unknown, max = 80) {
  return String(value || "").trim().slice(0, max)
}

function toPositiveInt(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : 0
}

function hoursSettingKey(plan: CoachingPlan) {
  return `PRIVATE_AI_COACHING_${plan.key.toUpperCase()}_MONTHLY_HOURS`
}

export async function GET(request: NextRequest) {
  try {
    const country = clean(request.nextUrl.searchParams.get("country") || "NG", 20) || "NG"
    const currency = currencyForCountry(country)
    const hourlyRateMinor = toPositiveInt(await getAdminSettingValue(`PRIVATE_AI_COACHING_HOURLY_RATE_${currency}_MINOR`))
    const discovery = await serviceCheckoutPricing({ slug: "private-ai-coaching-discovery", country })

    const plans = await Promise.all(
      coachingPlans.map(async (plan) => {
        const configuredHours = toPositiveInt(await getAdminSettingValue(hoursSettingKey(plan)))
        const monthlyHours = configuredHours || plan.monthlyHours
        const monthlyMinor = hourlyRateMinor ? hourlyRateMinor * monthlyHours : 0

        return {
          key: plan.key,
          name: plan.name,
          monthlyHours,
          monthlyMinor,
          monthlyLabel: monthlyMinor ? formatMinorAmount(monthlyMinor, currency) : "Configure in admin",
          hourlyRateMinor,
          hourlyRateLabel: hourlyRateMinor ? formatMinorAmount(hourlyRateMinor, currency) : "Configure in admin"
        }
      })
    )

    return NextResponse.json({
      ok: true,
      country,
      currency,
      discovery: {
        amountMinor: discovery.finalAmountMinor,
        baseAmountMinor: discovery.baseAmountMinor,
        label: discovery.label,
        baseLabel: discovery.baseLabel,
        provider: discovery.provider
      },
      plans
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load private coaching pricing." },
      { status: 500 }
    )
  }
}

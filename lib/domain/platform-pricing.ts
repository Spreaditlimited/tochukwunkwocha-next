import "server-only";
import { createRequire } from "node:module";
import { getAdminSettingValue } from "@/lib/admin-settings";

const require = createRequire(import.meta.url);
const registrar = require("./providers/resellerclub.js") as {
  getPlatformCostPrice: (
    input: unknown,
  ) => Promise<{ amountMinor: number; currency: string; fetchedAt: string }>;
};
export async function buildPlatformDomainQuote(
  hostname: string,
  years: number,
  country: string,
  operation: "register" | "renew" = "register",
) {
  if (!["NG", "GB"].includes(country))
    throw new Error("Domain purchasing is not available for this country.");
  const cost = await registrar.getPlatformCostPrice({
    domainName: hostname,
    years,
    operation,
  });
  const currency = country === "GB" ? "GBP" : "NGN";
  let fxRate = 1,
    fxDate = cost.fetchedAt.slice(0, 10);
  if (cost.currency !== currency) {
    if (cost.currency === "USD" && currency === "GBP") {
      const response = await fetch(
        "https://api.frankfurter.dev/v2/rate/USD/GBP",
        { cache: "no-store", signal: AbortSignal.timeout(10000) },
      );
      if (!response.ok)
        throw new Error(
          "The current exchange rate is unavailable. Please try again shortly.",
        );
      const data = await response.json();
      fxRate = Number(data.rate);
      fxDate = String(data.date || "");
      const age = Date.now() - Date.parse(fxDate);
      if (
        data.base !== "USD" ||
        data.quote !== "GBP" ||
        !Number.isFinite(age) ||
        age < -86400000 ||
        age > 7 * 86400000
      )
        throw new Error(
          "A current exchange rate could not be confirmed. Please try again shortly.",
        );
    } else if (currency === "NGN")
      fxRate = Number(
        await getAdminSettingValue("DOMAIN_FX_NGN_PER_" + cost.currency),
      );
    else
      throw new Error("Pricing in your currency is temporarily unavailable.");
  }
  if (!Number.isFinite(fxRate) || fxRate <= 0)
    throw new Error("Pricing in your currency is temporarily unavailable.");
  const configured = await getAdminSettingValue(
    "DOMAIN_PLATFORM_MARKUP_PERCENT",
  );
  const markupPercent = Number(
    configured || process.env.DOMAIN_TARGET_MARGIN_PERCENT || 20,
  );
  if (
    !Number.isFinite(markupPercent) ||
    markupPercent < 0 ||
    markupPercent > 200
  )
    throw new Error("Domain pricing needs review. Please contact support.");
  const baseMinor = Math.ceil(cost.amountMinor * fxRate),
    markupMinor = Math.ceil((baseMinor * markupPercent) / 100),
    subtotalMinor = baseMinor + markupMinor;
  const vatValue =
    country === "GB"
      ? await getAdminSettingValue("INTL_VAT_PERCENT")
      : process.env.DOMAIN_VAT_PERCENT || process.env.SITE_VAT_PERCENT;
  const vatPercent =
    vatValue === undefined || vatValue === ""
      ? country === "GB"
        ? 20
        : 7.5
      : Number(vatValue);
  if (!Number.isFinite(vatPercent) || vatPercent < 0 || vatPercent > 100)
    throw new Error("Domain tax pricing needs review.");
  const vatAmountMinor = Math.round((subtotalMinor * vatPercent) / 100);
  const totalAmountMinor = subtotalMinor + vatAmountMinor;
  // Stripe charges do not apply to partner PayPal checkout. Until a separate
  // PayPal fee policy is configured, processing is absorbed in our markup.
  if (!Number.isSafeInteger(totalAmountMinor) || totalAmountMinor <= 0)
    throw new Error("Invalid domain price.");
  return {
    currency,
    provider: country === "GB" ? "partner_paypal" : "partner_paystack",
    country,
    years,
    totalAmountMinor,
    registrarCostMinor: cost.amountMinor,
    registrarCurrency: cost.currency,
    fxRate,
    fxDate,
    markupPercent,
    markupMinor,
    subtotalMinor,
    vatPercent,
    vatAmountMinor,
    processingFeeMinor: totalAmountMinor - subtotalMinor - vatAmountMinor,
    pricedAt: cost.fetchedAt,
  };
}

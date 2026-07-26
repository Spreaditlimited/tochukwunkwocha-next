export function formatShopMoney(amountMinor: number, currency: string) {
  const normalizedCurrency = currency.toUpperCase()
  const showNairaKobo = normalizedCurrency === "NGN" && Math.abs(amountMinor) % 100 !== 0
  return new Intl.NumberFormat(normalizedCurrency === "NGN" ? "en-NG" : "en-GB", {
    style: "currency",
    currency: normalizedCurrency,
    minimumFractionDigits: showNairaKobo ? 2 : undefined,
    maximumFractionDigits: normalizedCurrency === "NGN" ? (showNairaKobo ? 2 : 0) : 2
  }).format(amountMinor / 100)
}

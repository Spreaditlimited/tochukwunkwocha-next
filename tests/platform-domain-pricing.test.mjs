import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
let rate = 0.74,
  date = new Date().toISOString().slice(0, 10),
  currency = "USD",
  cost = 1349,
  operation,
  calls = 0;
const settings = {
  DOMAIN_PLATFORM_MARKUP_PERCENT: "20",
  DOMAIN_FX_NGN_PER_USD: "1300",
  INTL_VAT_PERCENT: "20",
};
globalThis.__domainSettings = settings;
globalThis.__domainCost = async (input) => {
  calls++;
  operation = input.operation;
  return { currency, amountMinor: cost, fetchedAt: new Date().toISOString() };
};
const hook = registerHooks({
  resolve(s, c, next) {
    const inline = (code) => ({
      url: "data:text/javascript," + encodeURIComponent(code),
      shortCircuit: true,
    });
    if (s === "server-only") return inline("export{}");
    if (s === "@/lib/admin-settings")
      return inline(
        'export const getAdminSettingValue=async k=>globalThis.__domainSettings[k]||""',
      );
    if (s === "@/lib/payments/processing-fees")
      return inline(
        "export const getConfiguredStripeFee=async()=>({bps:0,fixedMinor:0});export const grossUpStripeAmount=n=>n",
      );
    if (s === "node:module")
      return inline(
        "export const createRequire=()=>()=>({getPlatformCostPrice:globalThis.__domainCost})",
      );
    return next(s, c);
  },
});
const { buildPlatformDomainQuote } = await import(
  "../lib/domain/platform-pricing.ts"
);
hook.deregister();
const originalFetch = globalThis.fetch;
globalThis.fetch = async () =>
  Response.json({ base: "USD", quote: "GBP", rate, date });
test.after(() => {
  globalThis.fetch = originalFetch;
});
test("UK price uses current USD/GBP then markup and tax, not NGN conversion", async () => {
  const q = await buildPlatformDomainQuote("example.com", 1, "GB");
  assert.equal(q.currency, "GBP");
  assert.equal(q.registrarCostMinor, 1349);
  assert.equal(q.fxRate, 0.74);
  assert.equal(q.markupMinor, 200);
  assert.equal(q.totalAmountMinor, 1439);
  assert.equal(q.provider, "partner_paypal");
});
test("a new quote fetches cost again and renewal uses the renewal operation", async () => {
  const before = calls;
  cost = 1399;
  await buildPlatformDomainQuote("example.com", 1, "GB", "renew");
  assert.equal(operation, "renew");
  assert.equal(calls, before + 1);
  cost = 1349;
});
test("Nigerian quote retains NGN settlement", async () => {
  const q = await buildPlatformDomainQuote("example.com", 1, "NG");
  assert.equal(q.currency, "NGN");
  assert.equal(q.provider, "partner_paystack");
  assert.equal(q.fxRate, 1300);
});
test("missing or stale FX fails closed", async () => {
  rate = 0;
  await assert.rejects(
    buildPlatformDomainQuote("example.com", 1, "GB"),
    /unavailable/,
  );
  rate = 0.74;
  date = "2020-01-01";
  await assert.rejects(
    buildPlatformDomainQuote("example.com", 1, "GB"),
    /current exchange/,
  );
  date = new Date().toISOString().slice(0, 10);
});
test("GBP registrar costs are not converted twice and zero markup is honoured", async () => {
  currency = "GBP";
  settings.DOMAIN_PLATFORM_MARKUP_PERCENT = "0";
  const q = await buildPlatformDomainQuote("example.com", 1, "GB");
  assert.equal(q.fxRate, 1);
  assert.equal(q.markupMinor, 0);
  currency = "USD";
  settings.DOMAIN_PLATFORM_MARKUP_PERCENT = "20";
});
test("unsupported countries and invalid markup fail closed", async () => {
  await assert.rejects(
    buildPlatformDomainQuote("example.com", 1, "US"),
    /not available/,
  );
  settings.DOMAIN_PLATFORM_MARKUP_PERCENT = "-1";
  await assert.rejects(
    buildPlatformDomainQuote("example.com", 1, "GB"),
    /needs review/,
  );
});

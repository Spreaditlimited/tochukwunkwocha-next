import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
const hooks = registerHooks({
  resolve(s, c, next) {
    if (s === "server-only")
      return { url: "data:text/javascript,export{}", shortCircuit: true };
    return next(s, c);
  },
});
const { expireUnpaidDomainStripe } = await import(
  "../lib/domain/legacy-checkout.ts"
);
hooks.deregister();
process.env.STRIPE_SECRET_KEY = "synthetic";
let session, expired;
globalThis.fetch = async (url, options) => {
  if (options.method === "POST") {
    expired++;
    session.status = "expired";
  }
  return Response.json(session);
};
test.beforeEach(() => {
  expired = 0;
  session = {
    id: "cs_test",
    amount_total: 1500,
    currency: "gbp",
    metadata: { platformOrderId: "domain" },
    payment_status: "unpaid",
    status: "open",
  };
});
test("an open unpaid session must be expired before replacement", async () => {
  assert.equal(
    await expireUnpaidDomainStripe("cs_test", "domain", 1500, "GBP"),
    true,
  );
  assert.equal(expired, 1);
});
test("paid sessions are retained for fulfilment, never expired", async () => {
  session.payment_status = "paid";
  session.status = "complete";
  assert.equal(
    await expireUnpaidDomainStripe("cs_test", "domain", 1500, "GBP"),
    false,
  );
  assert.equal(expired, 0);
});
test("processing sessions and wrong amounts block replacement", async () => {
  session.status = "complete";
  await assert.rejects(
    expireUnpaidDomainStripe("cs_test", "domain", 1500, "GBP"),
  );
  session.status = "open";
  await assert.rejects(expireUnpaidDomainStripe("cs_test", "domain", 1, "GBP"));
  assert.equal(expired, 0);
});

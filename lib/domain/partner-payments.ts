import "server-only";
import { createHmac, randomUUID } from "node:crypto";
export async function partnerDomainPayment(input: Record<string, unknown>) {
  const secret = process.env.SUREIMPORTS_DOMAIN_SERVICE_SECRET;
  const url = new URL(
    "/api/integrations/domain-payments",
    process.env.PARTNER_PAYMENT_ORIGIN || "https://partner.sureimports.com",
  );
  if (
    !secret ||
    secret.length < 32 ||
    (url.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw Error("Domain payment is temporarily unavailable.");
  const body = JSON.stringify(input),
    timestamp = String(Date.now()),
    nonce = randomUUID();
  const signature = createHmac("sha256", secret)
    .update(timestamp + "\n" + nonce + "\nPOST\n" + url.pathname + "\n" + body)
    .digest("hex");
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-platform-timestamp": timestamp,
      "x-platform-nonce": nonce,
      "x-platform-signature": signature,
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(55000),
  });
  if (!r.ok)
    throw Error(
      "Payment could not be confirmed. Check this request before paying again.",
    );
  return r.json();
}
export const partnerProvider = (provider: string) =>
  ["partner_paypal", "partner_paystack"].includes(provider);

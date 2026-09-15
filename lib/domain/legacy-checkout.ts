import "server-only";
export async function expireUnpaidDomainStripe(
  reference: string,
  id: string,
  amountMinor: number,
  currency: string,
) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret || !reference.startsWith("cs_"))
    throw Error("Previous checkout needs review.");
  const request = async (expire = false) => {
    const response = await fetch(
      "https://api.stripe.com/v1/checkout/sessions/" +
        encodeURIComponent(reference) +
        (expire ? "/expire" : ""),
      {
        method: expire ? "POST" : "GET",
        headers: { Authorization: "Bearer " + secret },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw Error(
        "Previous checkout could not be closed. Check its payment status first.",
      );
    return response.json();
  };
  const current = await request();
  if (
    current.id !== reference ||
    current.amount_total !== amountMinor ||
    String(current.currency).toUpperCase() !== currency ||
    ![
      current.metadata?.platformOrderId,
      current.metadata?.platformRenewalId,
    ].includes(id)
  )
    throw Error("Previous checkout does not match.");
  if (current.payment_status === "paid") return false;
  if (
    current.payment_status !== "unpaid" ||
    !["open", "expired"].includes(current.status)
  )
    throw Error(
      "A previous payment is processing. Please wait before paying again.",
    );
  if (current.status === "open") await request(true);
  const closed = await request();
  if (
    closed.id !== reference ||
    closed.status !== "expired" ||
    closed.payment_status !== "unpaid"
  )
    throw Error("Previous payment needs review.");
  return true;
}

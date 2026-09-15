import { expireUnpaidDomainStripe } from "./legacy-checkout";
import { partnerDomainPayment, partnerProvider } from "./partner-payments";
import { assertPlatformDomainFunding } from "./platform-funding";
import "server-only";
import { createRequire } from "node:module";
import {
  randomUUID,
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { supportedCheckoutDomain } from "@/lib/payments/domain-checkout";
import {
  retrieveStripeSession,
  verifyPaystackTransaction,
} from "@/lib/payments/course-checkout";
import { applyAdminSettingsToProcessEnv } from "@/lib/admin-settings";

import { buildPlatformDomainQuote } from "./platform-pricing";
const require = createRequire(import.meta.url);
type Registration = {
  domainName: string;
  orderId: string;
  active: boolean;
  expiresAt: string;
  registrantEmail: string;
};
const registrar = require("./providers/resellerclub.js") as {
  getRegistration: (input: { domainName: string }) => Promise<Registration>;
  addPlatformDnsRecord: (input: {
    domainName: string;
    host: string;
    type: string;
    value: string;
  }) => Promise<unknown>;
};
const client = require("../domain-client.cjs") as {
  selectedDomainProviderName: () => string;
  checkAvailability: (input: unknown) => Promise<{ available: boolean }>;
  registerDomain: (
    input: unknown,
  ) => Promise<{ success: boolean; orderId: string }>;
};
type Row = {
  country: string;
  currency: string;
  paymentProvider: string;
  id: string;
  partnerId: string;
  hostname: string;
  years: number;
  amountMinor: bigint;
  quoteExpiresAt: Date;
  status: string;
  paymentReference: string | null;
  checkoutUrl: string | null;
  registrantCiphertext: string | null;
  registrarOrderId: string | null;
  expiresAt: Date | null;
};
const profile = z
  .object({
    company: z.string().min(2).max(120),
    fullName: z.string().min(3).max(180),
    email: z.string().email().max(190),
    address1: z.string().min(5).max(240),
    city: z.string().min(2).max(120),
    state: z.string().min(2).max(120),
    postalCode: z.string().min(3).max(40),
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  })
  .strict();
export const platformCommand = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("replace-checkout"),
      partnerId: z.string().min(1).max(191),
      orderId: z.string().max(80),
    })
    .strict(),
  z
    .object({
      action: z.literal("capture"),
      partnerId: z.string().min(1).max(191),
      orderId: z.string().max(80),
    })
    .strict(),

  z
    .object({
      action: z.literal("quote"),
      country: z.enum(["NG", "GB"]).default("NG"),
      partnerId: z.string().min(1).max(191),
      hostname: z.string().max(191),
      years: z.number().int().min(1).max(5),
    })
    .strict(),
  z
    .object({
      action: z.literal("checkout"),
      country: z.enum(["NG", "GB"]).default("NG"),
      partnerId: z.string().min(1).max(191),
      quoteId: z.string().max(80),
      acceptedTotalMinor: z.number().int().positive(),
      registrant: profile,
      confirmed: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.literal("status"),
      partnerId: z.string().min(1).max(191),
      orderId: z.string().max(80),
    })
    .strict(),
  z
    .object({
      action: z.literal("list"),
      partnerId: z.string().min(1).max(191),
    })
    .strict(),
  z
    .object({
      action: z.literal("dns"),
      partnerId: z.string().min(1).max(191),
      orderId: z.string().max(80),
      records: z
        .array(
          z
            .object({
              host: z.string().max(191),
              type: z.enum(["TXT", "A", "CNAME"]),
              value: z.string().min(1).max(500),
            })
            .strict(),
        )
        .min(1)
        .max(12),
    })
    .strict(),
]);
function key() {
  const secret = process.env.SUREIMPORTS_DOMAIN_SERVICE_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Platform service unavailable.");
  return createHash("sha256").update(`domain-registrant-v1:${secret}`).digest();
}
function seal(data: unknown, id: string) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key(), iv);
  c.setAAD(Buffer.from(id));
  const body = Buffer.concat([c.update(JSON.stringify(data)), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}
function unseal(value: string, id: string) {
  const b = Buffer.from(value, "base64"),
    c = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  c.setAAD(Buffer.from(id));
  c.setAuthTag(b.subarray(12, 28));
  return profile.parse(
    JSON.parse(Buffer.concat([c.update(b.subarray(28)), c.final()]).toString()),
  );
}
function result(row: Row) {
  return {
    orderId: row.id,
    quoteId: row.id,
    hostname: row.hostname,
    amountMinor: Number(row.amountMinor),
    currency: row.currency || "NGN",
    status: row.status,
    checkoutUrl: row.checkoutUrl,
    paymentProvider: row.paymentProvider,
    paymentReference: row.paymentReference,
    partnerId: row.partnerId,
    years: row.years,
    expiresAt: row.expiresAt?.toISOString() || null,
    quoteExpiresAt: row.quoteExpiresAt.toISOString(),
  };
}
async function owned(partnerId: string, id: string) {
  const [row] = await prisma.$queryRaw<
    Row[]
  >`SELECT * FROM domain_platform_orders WHERE id=${id} AND partnerId=${partnerId}`;
  if (!row) throw new Error("Domain order not found.");
  return row;
}
async function configured() {
  await applyAdminSettingsToProcessEnv();
  if (client.selectedDomainProviderName() !== "resellerclub")
    throw new Error(
      "Platform registration requires the ResellerClub adapter with registration confirmation support.",
    );
}
export async function platformDomainCommand(
  input: z.infer<typeof platformCommand>,
): Promise<
  | ReturnType<typeof result>
  | { orders: ReturnType<typeof result>[] }
  | { status: "DNS_SUBMITTED"; hostname: string }
> {
  input = platformCommand.parse(input);
  await configured();
  if (input.action === "list") {
    const rows = await prisma.$queryRaw<
      Row[]
    >`SELECT * FROM domain_platform_orders WHERE partnerId=${input.partnerId} ORDER BY createdAt DESC LIMIT 30`;
    return { orders: rows.map(result) };
  }
  if (input.action === "quote") {
    const hostname = supportedCheckoutDomain(input.hostname);
    if (
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:com|net|org|co|io)$/.test(
        hostname,
      )
    )
      throw new Error(
        "Choose a supported .com, .net, .org, .co or .io domain.",
      );
    const [existing] = await prisma.$queryRaw<
      Row[]
    >`SELECT * FROM domain_platform_orders WHERE hostname=${hostname}`;
    if (existing) {
      if (existing.partnerId !== input.partnerId)
        throw new Error("This domain is reserved by another business.");
      if (existing.status !== "QUOTED") return result(existing);
    }
    const [count] = await prisma.$queryRaw<
      { total: bigint }[]
    >`SELECT COUNT(*) AS total FROM domain_platform_orders WHERE partnerId=${input.partnerId} AND createdAt>DATE_SUB(NOW(),INTERVAL 1 DAY)`;
    if (Number(count.total) >= 10 && !existing)
      throw new Error("Domain quote limit reached. Please try again tomorrow.");
    if (
      !(await client.checkAvailability({ domainName: hostname, strict: true }))
        .available
    )
      throw new Error("This domain is not available.");
    const quote = await buildPlatformDomainQuote(
      hostname,
      input.years,
      input.country,
    );
    const amount = quote.totalAmountMinor,
      expiry = new Date(Date.now() + 900000),
      id = existing?.id || `SPD_${randomUUID()}`;
    if (!Number.isSafeInteger(amount) || amount <= 0)
      throw new Error("Invalid domain quote.");
    if (existing)
      await prisma.$executeRaw`UPDATE domain_platform_orders SET country=${input.country},currency=${quote.currency},paymentProvider=${quote.provider},pricingJson=${JSON.stringify(quote)},amountMinor=${amount}, years=${input.years}, quoteExpiresAt=${expiry}, updatedAt=NOW(3) WHERE id=${id} AND status='QUOTED'`;
    else
      await prisma.$executeRaw`INSERT INTO domain_platform_orders(id,partnerId,hostname,years,amountMinor,quoteExpiresAt,country,currency,paymentProvider,pricingJson) VALUES(${id},${input.partnerId},${hostname},${input.years},${amount},${expiry},${input.country},${quote.currency},${quote.provider},${JSON.stringify(quote)})`;
    return result(await owned(input.partnerId, id));
  }
  const row = await owned(
    input.partnerId,
    input.action === "checkout" ? input.quoteId : input.orderId,
  );
  if (input.action === "dns") {
    if (row.status !== "REGISTERED")
      throw new Error("Registration must be confirmed before DNS changes.");
    const confirmation = await registrar.getRegistration({
      domainName: row.hostname,
    });
    if (
      !confirmation.active ||
      confirmation.orderId !== row.registrarOrderId ||
      new Date(confirmation.expiresAt) <= new Date()
    )
      throw new Error("Registrar ownership or expiry requires review.");
    for (const record of input.records) {
      if (
        record.type === "TXT" &&
        !/^_(?:sureimports|vercel)(?:\.[a-z0-9-]+)*$/.test(record.host)
      )
        throw new Error("Only platform ownership TXT records are allowed.");
      if (record.type !== "TXT" && record.host !== "")
        throw new Error(
          "Platform hosting records must target the purchased domain.",
        );
      if (
        record.type === "CNAME" &&
        !/^[a-z0-9.-]+\.vercel-dns(?:-\d+)?\.com\.?$/.test(record.value)
      )
        throw new Error("Unexpected hosting target.");
      if (
        record.type === "A" &&
        !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(record.value)
      )
        throw new Error("Invalid IPv4 record.");
    }
    // Inputs come only from the signed Sure Imports service, never a public DNS editor.
    for (const record of input.records)
      await registrar.addPlatformDnsRecord({
        domainName: row.hostname,
        ...record,
      });
    return { status: "DNS_SUBMITTED", hostname: row.hostname };
  }
  if (input.action === "replace-checkout") {
    if (
      row.paymentProvider !== "stripe" ||
      row.status !== "CHECKOUT_PENDING" ||
      !row.paymentReference
    )
      throw Error("Check the current domain request before starting payment.");
    if (
      !(await expireUnpaidDomainStripe(
        row.paymentReference,
        row.id,
        Number(row.amountMinor),
        row.currency,
      ))
    )
      return completePlatformDomainPayment(row.id, input.partnerId);
    const reset =
      await prisma.$executeRaw`UPDATE domain_platform_orders SET status='QUOTED',paymentReference=NULL,checkoutUrl=NULL,updatedAt=NOW(3) WHERE id=${row.id} AND status='CHECKOUT_PENDING' AND paymentReference=${row.paymentReference}`;
    if (!reset) throw Error("Payment status changed. Refresh this request.");
    return platformDomainCommand({
      action: "quote",
      partnerId: row.partnerId,
      country: row.country as "NG" | "GB",
      hostname: row.hostname,
      years: row.years,
    });
  }
  if (input.action === "status")
    return completePlatformDomainPayment(row.id, input.partnerId);
  if (input.action === "capture") {
    if (
      row.paymentProvider === "partner_paypal" &&
      row.status !== "CHECKOUT_PENDING"
    )
      return completePlatformDomainPayment(row.id, input.partnerId);
    if (
      row.paymentProvider !== "partner_paypal" ||
      row.status !== "CHECKOUT_PENDING" ||
      !row.paymentReference
    )
      throw Error("Payment is not awaiting confirmation.");
    await partnerDomainPayment({
      action: "capture",
      id: row.id,
      partnerId: row.partnerId,
      hostname: row.hostname,
      amountMinor: Number(row.amountMinor),
      currency: row.currency,
      email: "unused@sureimports.com",
      reference: row.paymentReference,
    });
    return completePlatformDomainPayment(row.id, input.partnerId);
  }
  if ((row.country || "NG") !== input.country)
    throw new Error(
      "This quote uses a different billing country. Request a fresh quote.",
    );
  await assertPlatformDomainFunding(row.hostname, row.years, "register");
  if (partnerProvider(row.paymentProvider)) {
    if (row.status === "CHECKOUT_PENDING" && row.paymentReference)
      return result(row);
    if (
      row.status !== "QUOTED" ||
      row.quoteExpiresAt <= new Date() ||
      Number(row.amountMinor) !== input.acceptedTotalMinor
    )
      throw Error(
        "This quote has expired or payment is already being prepared. Refresh the request.",
      );

    const claimed =
      await prisma.$executeRaw`UPDATE domain_platform_orders SET status='CHECKOUT_PENDING',updatedAt=NOW(3),registrantCiphertext=${seal(input.registrant, row.id)} WHERE id=${row.id} AND status='QUOTED' AND amountMinor=${input.acceptedTotalMinor} AND quoteExpiresAt>NOW(3)`;
    if (!claimed)
      throw Error("Payment is already being prepared. Refresh the request.");
    const payment = await partnerDomainPayment({
      action: "create",
      id: row.id,
      partnerId: row.partnerId,
      hostname: row.hostname,
      amountMinor: Number(row.amountMinor),
      currency: row.currency,
      email: input.registrant.email,
    });
    if (typeof payment.reference !== "string" || !payment.reference)
      throw Error("Payment preparation needs review. Do not pay again.");
    await prisma.$executeRaw`UPDATE domain_platform_orders SET paymentReference=${payment.reference},checkoutUrl=${payment.checkoutUrl || null},updatedAt=NOW(3) WHERE id=${row.id} AND status='CHECKOUT_PENDING' AND paymentReference IS NULL`;
    return result(await owned(input.partnerId, row.id));
  }
  if (row.checkoutUrl) return result(row);
  throw Error("Please check the price again to use the new partner checkout.");
}
export async function completePlatformDomainPayment(
  id: string,
  partnerId?: string,
) {
  await configured();
  const [row] = partnerId
    ? [await owned(partnerId, id)]
    : await prisma.$queryRaw<
        Row[]
      >`SELECT * FROM domain_platform_orders WHERE id=${id} OR paymentReference=${id} LIMIT 1`;
  if (!row) throw new Error("Domain order not found.");
  if (
    ![
      "QUOTED",
      "CHECKOUT_PENDING",
      "REGISTERING",
      "RECONCILIATION_REQUIRED",
      "REGISTERED",
    ].includes(row.status)
  )
    return result(row);
  if (row.status === "REGISTERED") {
    const registration = await registrar.getRegistration({
      domainName: row.hostname,
    });
    if (registration.orderId !== row.registrarOrderId)
      throw new Error("Registrar ownership requires review.");
    await prisma.$executeRaw`UPDATE domain_platform_orders SET expiresAt=${new Date(registration.expiresAt)},updatedAt=NOW(3) WHERE id=${row.id}`;
    return {
      ...result(await owned(row.partnerId, row.id)),
      registrarActive: registration.active,
    };
  }
  if (
    row.status === "CHECKOUT_PENDING" &&
    !row.paymentReference &&
    partnerProvider(row.paymentProvider)
  ) {
    const recovered = await partnerDomainPayment({
      action: "recover",
      id: row.id,
      partnerId: row.partnerId,
      hostname: row.hostname,
      amountMinor: Number(row.amountMinor),
      currency: row.currency,
      email: "unused@sureimports.com",
    });
    if (!recovered.reference)
      return {
        ...result(row),
        message:
          "Payment preparation has not been confirmed. Contact support before starting another payment.",
      };
    await prisma.$executeRaw`UPDATE domain_platform_orders SET paymentReference=${recovered.reference},checkoutUrl=${recovered.checkoutUrl || null},updatedAt=NOW(3) WHERE id=${row.id} AND status='CHECKOUT_PENDING' AND paymentReference IS NULL`;
    return completePlatformDomainPayment(row.id, row.partnerId);
  }
  if (!row.paymentReference) return result(row);
  const payment = partnerProvider(row.paymentProvider)
    ? await partnerDomainPayment({
        action: "read",
        id: row.id,
        partnerId: row.partnerId,
        hostname: row.hostname,
        amountMinor: Number(row.amountMinor),
        currency: row.currency,
        email: "unused@sureimports.com",
        reference: row.paymentReference,
      })
    : row.paymentProvider === "stripe"
      ? await retrieveStripeSession(row.paymentReference).then((p) => ({
          ...p,
          reference: p.id,
          domain: p.livemode ? "live" : "test",
        }))
      : await verifyPaystackTransaction(row.paymentReference);
  if (
    partnerProvider(row.paymentProvider) &&
    (!("paid" in payment) || payment.paid !== true)
  )
    return result(row);
  if (
    payment.domain !== "live" ||
    payment.reference !== row.paymentReference ||
    payment.currency !== (row.currency || "NGN") ||
    payment.amountMinor !== Number(row.amountMinor) ||
    payment.metadata?.platformOrderId !== row.id ||
    payment.metadata?.payment_scope !== "sureimports_domain"
  )
    throw new Error("Domain payment requires reconciliation.");
  if (row.status === "CHECKOUT_PENDING")
    await assertPlatformDomainFunding(row.hostname, row.years, "register");
  const registrant = unseal(row.registrantCiphertext!, row.id);
  const acquired =
    await prisma.$executeRaw`UPDATE domain_platform_orders SET status='REGISTERING',updatedAt=NOW(3) WHERE id=${row.id} AND status='CHECKOUT_PENDING'`;
  if (acquired) {
    try {
      const registration = await client.registerDomain({
        externallyPaid: true,
        domainName: row.hostname,
        years: row.years,
        fullName: registrant.fullName,
        registrantCompany: registrant.company,
        email: registrant.email,
        registrantAddress1: registrant.address1,
        registrantCity: registrant.city,
        registrantState: registrant.state,
        registrantCountry: row.country || "NG",
        registrantPostalCode: registrant.postalCode,
        registrantPhone: registrant.phone.slice(
          registrant.phone.startsWith("+44") ? 3 : 4,
        ),
        registrantPhoneCc: registrant.phone.startsWith("+44") ? "44" : "234",
        strict: true,
      });
      if (!registration.success)
        throw new Error("Registrar registration needs review.");
      await prisma.$executeRaw`UPDATE domain_platform_orders SET registrarOrderId=${registration.orderId},updatedAt=NOW(3) WHERE id=${row.id}`;
    } catch {
      await prisma.$executeRaw`UPDATE domain_platform_orders SET status='RECONCILIATION_REQUIRED',updatedAt=NOW(3) WHERE id=${row.id} AND status='REGISTERING'`;
    }
  }
  // Never repeat registerDomain after a timeout. Reconcile registrar state instead.
  try {
    const confirmation = await registrar.getRegistration({
      domainName: row.hostname,
    });
    const saved = await owned(row.partnerId, row.id);
    if (
      saved.registrarOrderId &&
      saved.registrarOrderId !== confirmation.orderId
    )
      throw new Error("Registrar reference needs review.");
    if (
      !confirmation.active ||
      confirmation.registrantEmail !== registrant.email.toLowerCase()
    )
      throw new Error("Registrant confirmation pending.");
    await prisma.$executeRaw`UPDATE domain_platform_orders SET status='REGISTERED',registrarOrderId=${confirmation.orderId},expiresAt=${new Date(confirmation.expiresAt)},updatedAt=NOW(3) WHERE id=${row.id} AND status IN ('REGISTERING','RECONCILIATION_REQUIRED')`;
  } catch {
    /* Pending or uncertain registration stays visible for operator review. */
  }
  return result(await owned(row.partnerId, row.id));
}

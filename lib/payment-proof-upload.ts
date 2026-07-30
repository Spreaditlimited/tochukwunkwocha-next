import crypto, { randomUUID } from "crypto"

export const PAYMENT_PROOF_MAX_BYTES = 8 * 1024 * 1024
export const PAYMENT_PROOF_FOLDER = "tochukwunkwocha-site/manual-payments"
export const PAYMENT_PROOF_ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
])

function clean(value: unknown, max = 2000) {
  return String(value || "").trim().slice(0, max)
}

function cloudinaryConfig() {
  const cloudName = clean(process.env.CLOUDINARY_CLOUD_NAME, 190)
  const apiKey = clean(process.env.CLOUDINARY_API_KEY, 190)
  const apiSecret = clean(process.env.CLOUDINARY_API_SECRET, 1000)
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured.")
  }
  return { cloudName, apiKey, apiSecret }
}

function proofSigningSecret() {
  const secret = clean(
    process.env.PAYMENT_PROOF_SIGNING_SECRET ||
      process.env.AUTH_SECRET ||
      process.env.ADMIN_SESSION_SECRET ||
      process.env.CLOUDINARY_API_SECRET,
    2000
  )
  if (!secret) throw new Error("Payment proof signing is not configured.")
  return secret
}

function hmac(value: string) {
  return crypto.createHmac("sha256", proofSigningSecret()).update(value).digest("base64url")
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function cloudinarySignature(params: Record<string, string | number | boolean>, apiSecret: string) {
  const canonical = Object.entries(params)
    .filter(([, value]) => value !== "" && value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")
  return crypto.createHash("sha1").update(`${canonical}${apiSecret}`).digest("hex")
}

export function createPaymentProofToken(publicIdInput: unknown, resourceTypeInput: unknown, expiresAtInput?: number) {
  const publicId = clean(publicIdInput, 255)
  const resourceType = clean(resourceTypeInput, 20)
  if (!publicId.startsWith(`${PAYMENT_PROOF_FOLDER}/`) || !["image", "raw"].includes(resourceType)) {
    throw new Error("Invalid payment proof asset.")
  }
  const expiresAt = Number(expiresAtInput) || Math.floor(Date.now() / 1000) + 4 * 60 * 60
  const tokenPayload = Buffer.from(JSON.stringify({ publicId, resourceType, expiresAt })).toString("base64url")
  return `${tokenPayload}.${hmac(tokenPayload)}`
}

export function validatePaymentProofFile(input: { type: unknown; size: unknown }) {
  const type = clean(input.type, 120).toLowerCase()
  const size = Math.round(Number(input.size || 0))
  if (!PAYMENT_PROOF_ALLOWED_TYPES.has(type)) {
    throw new Error("Upload a JPG, PNG, WebP, or PDF proof file.")
  }
  if (!Number.isFinite(size) || size <= 0 || size > PAYMENT_PROOF_MAX_BYTES) {
    throw new Error("Proof file must be 8MB or smaller.")
  }
  return { type, size }
}

export function createPaymentProofUploadAuthorization(input: { type: unknown; size: unknown }) {
  const file = validatePaymentProofFile(input)
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig()
  const resourceType = file.type === "application/pdf" ? "raw" : "image"
  const publicId = `${PAYMENT_PROOF_FOLDER}/receipt_${randomUUID().replace(/-/g, "")}${resourceType === "raw" ? ".pdf" : ""}`
  const timestamp = Math.floor(Date.now() / 1000)
  const expiresAt = timestamp + 4 * 60 * 60
  const uploadParams = {
    overwrite: false,
    public_id: publicId,
    timestamp
  }
  const signature = cloudinarySignature(uploadParams, apiSecret)
  const proofToken = createPaymentProofToken(publicId, resourceType, expiresAt)

  return {
    cloudName,
    apiKey,
    resourceType,
    publicId,
    timestamp,
    expiresAt,
    overwrite: false,
    signature,
    proofToken,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`
  }
}

export function trustedPaymentProof(input: {
  proofUrl: unknown
  proofPublicId: unknown
  proofResourceType?: unknown
  proofVersion?: unknown
  proofSignature?: unknown
  proofToken?: unknown
}) {
  const proofUrl = clean(input.proofUrl, 2000)
  const proofPublicId = clean(input.proofPublicId, 255)
  const cloudName = clean(process.env.CLOUDINARY_CLOUD_NAME, 190)
  if (!cloudName || !proofPublicId.startsWith(`${PAYMENT_PROOF_FOLDER}/`)) return false

  try {
    const url = new URL(proofUrl)
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || !url.pathname.startsWith(`/${cloudName}/`)) {
      return false
    }
  } catch {
    return false
  }

  const proofToken = clean(input.proofToken, 2000)
  if (!proofToken) {
    // Compatibility for uploads completed through the original server relay.
    return true
  }

  const [encodedPayload, tokenSignature, extra] = proofToken.split(".")
  if (!encodedPayload || !tokenSignature || extra || !safeEqual(tokenSignature, hmac(encodedPayload))) return false

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      publicId?: string
      resourceType?: string
      expiresAt?: number
    }
    const resourceType = clean(input.proofResourceType, 20)
    const version = Math.round(Number(input.proofVersion || 0))
    const responseSignature = clean(input.proofSignature, 190)
    if (
      payload.publicId !== proofPublicId ||
      payload.resourceType !== resourceType ||
      !Number.isFinite(payload.expiresAt) ||
      Number(payload.expiresAt) < Math.floor(Date.now() / 1000) ||
      version <= 0 ||
      !responseSignature
    ) {
      return false
    }
    const { apiSecret } = cloudinaryConfig()
    const expectedResponseSignature = crypto
      .createHash("sha1")
      .update(`public_id=${proofPublicId}&version=${version}${apiSecret}`)
      .digest("hex")
    return safeEqual(responseSignature, expectedResponseSignature)
  } catch {
    return false
  }
}

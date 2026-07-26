import { v2 as cloudinary, type UploadApiResponse } from "cloudinary"

let configured = false

function configureCloudinary() {
  if (configured) return
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim()
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim()
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim()
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary server credentials are not configured.")
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  })
  configured = true
}

export type PrivateCloudinaryAsset = {
  publicId: string
  resourceType: string
  deliveryType: string
  format: string
  version: string
  bytes: number
}

export async function uploadAuthenticatedPdf(input: {
  filePath: string
  publicId: string
}): Promise<PrivateCloudinaryAsset> {
  configureCloudinary()
  const result = (await cloudinary.uploader.upload(input.filePath, {
    public_id: input.publicId,
    resource_type: "raw",
    type: "authenticated",
    overwrite: true,
    invalidate: true,
    use_filename: false,
    unique_filename: false
  })) as UploadApiResponse
  if (
    !result.public_id ||
    result.resource_type !== "raw" ||
    result.type !== "authenticated"
  ) {
    throw new Error("Cloudinary did not return the expected authenticated raw asset.")
  }
  return {
    publicId: result.public_id,
    resourceType: result.resource_type,
    deliveryType: result.type,
    format: String(result.format || "pdf"),
    version: String(result.version || ""),
    bytes: Number(result.bytes || 0)
  }
}

export function createPrivateCloudinaryDownloadUrl(input: {
  publicId: string
  resourceType?: string | null
  deliveryType?: string | null
  format?: string | null
  expiresInSeconds?: number
}) {
  configureCloudinary()
  const expiresAt =
    Math.floor(Date.now() / 1000) +
    Math.max(30, Math.min(300, input.expiresInSeconds || 120))
  return cloudinary.utils.private_download_url(
    input.publicId,
    String(input.format || "pdf"),
    {
      resource_type: (input.resourceType || "raw") as "raw",
      type: (input.deliveryType || "authenticated") as "authenticated",
      attachment: true,
      expires_at: expiresAt
    }
  )
}

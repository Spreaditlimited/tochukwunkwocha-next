type TransformOptions = {
  width?: number
  height?: number
  crop?: "fill" | "fit" | "scale" | "limit" | "thumb"
  quality?: "auto" | number
  format?: "auto" | "webp" | "jpg" | "png" | "avif"
}

const CLOUDINARY_HOST = "res.cloudinary.com"

export function isCloudinaryUrl(url: string) {
  const value = String(url || "").trim()
  return value.includes(CLOUDINARY_HOST) && value.includes("/image/upload/")
}

export function resolveMediaUrl(
  value: string | null | undefined,
  baseUrl: string | null | undefined = process.env.NEXT_PUBLIC_CLOUDINARY_BASE_URL
) {
  const media = String(value || "").trim()
  if (!media) return ""
  if (/^(https?:)?\/\//.test(media) || media.startsWith("data:") || media.startsWith("/")) return media

  const base = String(baseUrl || "").trim().replace(/\/$/, "")
  return base ? `${base}/${media.replace(/^\/+/, "")}` : media
}

export function cloudinaryTransformUrl(url: string, options: TransformOptions = {}) {
  if (!isCloudinaryUrl(url)) return url

  const transforms = [
    options.format ? `f_${options.format}` : "",
    options.quality !== undefined ? `q_${options.quality}` : "",
    options.width ? `w_${options.width}` : "",
    options.height ? `h_${options.height}` : "",
    options.crop ? `c_${options.crop}` : ""
  ].filter(Boolean)

  return transforms.length
    ? url.replace("/image/upload/", `/image/upload/${transforms.join(",")}/`)
    : url
}

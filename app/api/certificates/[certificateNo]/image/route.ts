import { getVerifiedCertificate } from "@/lib/certificate-verification"
import { readFile } from "fs/promises"
import path from "path"

export const dynamic = "force-dynamic"

function escapeSvg(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function formatIssuedDate(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "long", day: "numeric" }).format(date)
}

function fitText(value: string, max = 42) {
  const text = String(value || "").trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

let logoDataUriCache = ""

async function getLogoDataUri() {
  if (logoDataUriCache) return logoDataUriCache
  const logoPath = path.join(process.cwd(), "public", "brand", "tochukwu-tech-logo.png")
  const buffer = await readFile(logoPath)
  logoDataUriCache = `data:image/png;base64,${buffer.toString("base64")}`
  return logoDataUriCache
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ certificateNo: string }> }
) {
  const { certificateNo } = await params
  const certificate = await getVerifiedCertificate(certificateNo)
  if (!certificate) return new Response("Certificate not found", { status: 404 })

  const url = new URL(request.url)
  const download = url.searchParams.get("download") === "1"
  const recipientName = escapeSvg(fitText(certificate.recipientName, 38))
  const courseName = escapeSvg(fitText(certificate.courseName, 58))
  const certNo = escapeSvg(certificate.certificateNo)
  const issuedAt = escapeSvg(formatIssuedDate(certificate.issuedAt))
  const verificationUrl = escapeSvg(fitText(certificate.verificationUrl, 92))
  const logoDataUri = await getLogoDataUri()

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="3200" height="2000" viewBox="0 0 1600 1000" role="img" aria-label="Verified certificate">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.62" stop-color="#fbfdff"/>
      <stop offset="1" stop-color="#eef7ff"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#06162d" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect width="1600" height="1000" fill="#071426"/>
  <rect width="1600" height="1000" fill="rgba(117,200,232,0.05)"/>
  <rect x="96" y="78" width="1408" height="844" rx="22" fill="url(#paper)" filter="url(#shadow)"/>
  <rect x="132" y="114" width="1336" height="772" rx="18" fill="none" stroke="#0d4f9a" stroke-opacity="0.2" stroke-width="4"/>
  <circle cx="1358" cy="732" r="116" fill="#e4f4ff" opacity="0.42"/>
  <image href="${logoDataUri}" x="170" y="150" width="374" height="88" preserveAspectRatio="xMidYMid meet"/>

  <g transform="translate(1336 178)">
    <circle cx="0" cy="0" r="58" fill="#0d4f9a" fill-opacity="0.07" stroke="#0d4f9a" stroke-opacity="0.24" stroke-width="4"/>
    <path d="M-23 -1l16 18 34 -37" fill="none" stroke="#0d4f9a" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  </g>

  <text x="800" y="306" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" letter-spacing="9" fill="#0d4f9a">TOCHUKWU TECH AND AI ACADEMY</text>
  <text x="800" y="410" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="74" font-weight="700" fill="#06162d">Certificate of Completion</text>
  <text x="800" y="494" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" letter-spacing="8" fill="#64748b">THIS CERTIFIES THAT</text>
  <text x="800" y="604" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="76" font-weight="700" fill="#06162d">${recipientName}</text>
  <text x="800" y="684" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="500" fill="#475569">has successfully completed</text>
  <text x="800" y="732" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="900" fill="#06162d">${courseName}</text>

  <line x1="170" y1="792" x2="1430" y2="792" stroke="#d6e0ea" stroke-width="3"/>
  <g transform="translate(170 824)">
    <rect x="0" y="0" width="440" height="72" rx="12" fill="#f8fbff" stroke="#d6e0ea"/>
    <text x="28" y="28" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="900" letter-spacing="5" fill="#64748b">CERTIFICATE NO</text>
    <text x="28" y="58" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="900" fill="#06162d">${certNo}</text>
  </g>
  <g transform="translate(990 824)">
    <rect x="0" y="0" width="440" height="72" rx="12" fill="#f8fbff" stroke="#d6e0ea"/>
    <text x="412" y="28" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="900" letter-spacing="5" fill="#64748b">DATE ISSUED</text>
    <text x="412" y="58" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="900" fill="#06162d">${issuedAt}</text>
  </g>
  <text x="800" y="918" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" fill="#64748b">Verify: ${verificationUrl}</text>
</svg>`

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
      ...(download
        ? {
            "Content-Disposition": `attachment; filename="tochukwu-certificate-${certificate.certificateNo}.svg"`
          }
        : {})
    }
  })
}

import { readFile } from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"

import { createPrivateCloudinaryDownloadUrl } from "@/lib/cloudinary/private-assets"
import {
  getDownloadableEntitlement,
  getTokenDownloadableEntitlement,
  recordShopDownload,
  resolveShopDigitalAsset
} from "@/lib/shop"
import { getStudentSession } from "@/lib/student-auth"
import { verifyShopDownloadToken } from "@/lib/shop-download-token"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entitlementUuid: string }> }
) {
  const { entitlementUuid } = await params
  const url = new URL(_request.url)
  const token = verifyShopDownloadToken(url.searchParams.get("token") || "", entitlementUuid)
  const session = token ? null : await getStudentSession()
  if (!token && !session) return NextResponse.redirect(new URL("/dashboard/login", _request.url))
  const entitlement = token
    ? await getTokenDownloadableEntitlement({
        entitlementUuid,
        email: token.email
      })
    : await getDownloadableEntitlement({
        entitlementUuid,
        accountId: session!.account.id,
        email: session!.account.email
      })
  if (!entitlement) {
    return NextResponse.json({ ok: false, error: "Download access was not found." }, { status: 404 })
  }
  if (entitlement.variant?.cloudinaryPublicId) {
    try {
      const downloadUrl = createPrivateCloudinaryDownloadUrl({
        publicId: entitlement.variant.cloudinaryPublicId,
        resourceType: entitlement.variant.cloudinaryResourceType,
        deliveryType: entitlement.variant.cloudinaryDeliveryType,
        format: entitlement.variant.cloudinaryFormat,
        expiresInSeconds: 120
      })
      await recordShopDownload(entitlementUuid)
      return NextResponse.redirect(downloadUrl, {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff"
        }
      })
    } catch {
      return NextResponse.json(
        { ok: false, error: "The secure workbook link could not be created." },
        { status: 503 }
      )
    }
  }
  const assetPath = resolveShopDigitalAsset(entitlement.variant?.digitalAssetKey || "")
  if (!assetPath) {
    return NextResponse.json({ ok: false, error: "The workbook file is unavailable." }, { status: 404 })
  }
  try {
    const file = await readFile(assetPath)
    const filename = String(
      entitlement.variant?.digitalFilename ||
        path.basename(assetPath) ||
        "workbook.pdf"
    ).replace(/[^a-zA-Z0-9._ -]/g, "")
    await recordShopDownload(entitlementUuid)
    return new Response(Uint8Array.from(file), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff"
      }
    })
  } catch {
    return NextResponse.json({ ok: false, error: "The workbook file could not be opened." }, { status: 404 })
  }
}

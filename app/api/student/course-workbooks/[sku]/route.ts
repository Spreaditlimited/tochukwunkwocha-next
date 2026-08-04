import { readFile } from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"

import { createPrivateCloudinaryDownloadUrl } from "@/lib/cloudinary/private-assets"
import { getIncludedPromptToProfitWorkbook } from "@/lib/course-workbooks"
import { resolveShopDigitalAsset } from "@/lib/shop"
import { getStudentSession } from "@/lib/student-auth"
import { setStudentToast } from "@/lib/student-toast"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function dashboardCoursesUrl(request: Request) {
  return new URL("/dashboard/courses", request.url)
}

async function workbookError(request: Request, message: string) {
  await setStudentToast({
    type: "error",
    title: "Workbook download unavailable",
    message
  })
  return NextResponse.redirect(dashboardCoursesUrl(request))
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sku: string }> }
) {
  const session = await getStudentSession()
  if (!session) return NextResponse.redirect(new URL("/dashboard/login", request.url))

  const { sku } = await params
  const result = await getIncludedPromptToProfitWorkbook({
    accountId: session.account.id,
    email: session.account.email,
    sku
  }).catch(() => null)

  if (!result?.access.enrolled) {
    return workbookError(
      request,
      "This download is included only with a completed Prompt to Profit enrollment."
    )
  }
  if (!result.access.batchStarted) {
    return workbookError(request, "Your workbooks will unlock when your assigned batch starts.")
  }
  const workbook = result.workbook
  if (!workbook) return workbookError(request, "The selected workbook is not available.")

  if (workbook.cloudinaryPublicId) {
    try {
      const downloadUrl = createPrivateCloudinaryDownloadUrl({
        publicId: workbook.cloudinaryPublicId,
        resourceType: workbook.cloudinaryResourceType,
        deliveryType: workbook.cloudinaryDeliveryType,
        format: workbook.cloudinaryFormat,
        expiresInSeconds: 120
      })
      return NextResponse.redirect(downloadUrl, {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff"
        }
      })
    } catch {
      return workbookError(request, "The secure workbook link could not be created. Please try again.")
    }
  }

  const assetPath = resolveShopDigitalAsset(workbook.digitalAssetKey || "")
  if (!assetPath) {
    return workbookError(request, "The workbook file is not available yet. Please try again later.")
  }

  try {
    const file = await readFile(assetPath)
    const filename = String(workbook.digitalFilename || path.basename(assetPath) || "workbook.pdf")
      .replace(/[^a-zA-Z0-9._ -]/g, "")
    return new Response(Uint8Array.from(file), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff"
      }
    })
  } catch {
    return workbookError(request, "The workbook file could not be opened. Please try again later.")
  }
}

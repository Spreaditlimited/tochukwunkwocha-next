"use client"

import { useState } from "react"
import { Check, Copy, Download, Share2 } from "lucide-react"

type CertificateShareActionsProps = {
  verificationUrl: string
  shareImageUrl: string
  certificateNo: string
}

export function CertificateShareActions({
  verificationUrl,
  shareImageUrl,
  certificateNo
}: CertificateShareActionsProps) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [message, setMessage] = useState("")

  function absoluteHref(value: string) {
    if (!value) return ""
    return new URL(value, window.location.origin).toString()
  }

  function withDownloadParam(value: string) {
    const separator = value.includes("?") ? "&" : "?"
    return `${value}${separator}download=1`
  }

  async function getSharePngBlob() {
    const response = await fetch(absoluteHref(withDownloadParam(shareImageUrl)))
    if (!response.ok) throw new Error("The share image could not be generated.")
    const svgText = await response.text()
    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" })
    const svgUrl = URL.createObjectURL(svgBlob)

    try {
      const image = new Image()
      image.decoding = "async"
      image.src = svgUrl
      await image.decode()

      const canvas = document.createElement("canvas")
      canvas.width = 3200
      canvas.height = 2000
      const context = canvas.getContext("2d")
      if (!context) throw new Error("The share image could not be prepared.")
      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = "high"
      context.drawImage(image, 0, 0, canvas.width, canvas.height)

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
          else reject(new Error("The share image could not be prepared."))
        }, "image/png", 0.95)
      })
    } finally {
      URL.revokeObjectURL(svgUrl)
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(absoluteHref(verificationUrl))
    setCopied(true)
    setMessage("Verification link copied.")
    window.setTimeout(() => setCopied(false), 1800)
  }

  async function downloadShareImage() {
    try {
      setMessage("")
      setDownloading(true)
      const blob = await getSharePngBlob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = `tochukwu-certificate-${certificateNo}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
      setMessage("Share image downloaded.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The share image could not be downloaded.")
    } finally {
      setDownloading(false)
    }
  }

  async function shareCertificate() {
    try {
      setMessage("")
      setSharing(true)
      const verificationLink = absoluteHref(verificationUrl)

      if (navigator.share) {
        const blob = await getSharePngBlob()
        const file = new File([blob], `tochukwu-certificate-${certificateNo}.png`, { type: "image/png" })
        const shareData = {
          title: `Certificate ${certificateNo}`,
          text: "Verify this Tochukwu Tech and AI Academy certificate.",
          url: verificationLink,
          files: [file]
        }

        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share(shareData)
          return
        }

        await navigator.share({
          title: shareData.title,
          text: shareData.text,
          url: verificationLink
        })
        return
      }

      await copyLink()
    } catch (error) {
      if ((error as { name?: string })?.name !== "AbortError") {
        await copyLink()
        setMessage("Sharing the image was not available, so the verification link was copied instead.")
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <button type="button" onClick={copyLink} className="btn-secondary h-12 min-w-[132px] shrink-0 whitespace-nowrap bg-white/95 px-5 text-slate-900 hover:bg-white">
        {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
        {copied ? "Copied" : "Copy Link"}
      </button>
      <button
        type="button"
        onClick={downloadShareImage}
        disabled={downloading}
        aria-busy={downloading}
        className="btn-secondary h-12 min-w-[178px] shrink-0 whitespace-nowrap bg-white/95 px-5 text-slate-900 hover:bg-white disabled:cursor-wait disabled:opacity-80"
      >
        <Download className="mr-2 h-4 w-4" />
        Download Image
      </button>
      <button type="button" onClick={shareCertificate} disabled={sharing} aria-busy={sharing} className="btn-primary h-12 min-w-[112px] shrink-0 whitespace-nowrap px-5 disabled:cursor-wait disabled:opacity-80">
        <Share2 className="mr-2 h-4 w-4" />
        Share
      </button>
      <span className="sr-only" aria-live="polite">{message}</span>
    </div>
  )
}

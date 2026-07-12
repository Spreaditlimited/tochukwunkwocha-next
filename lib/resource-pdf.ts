import fs from "node:fs/promises"
import path from "node:path"

import type { ResourceRow } from "@/lib/resources"

function cleanText(value: string) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/—/g, "-")
    .replace(/–/g, "-")
    .replace(/™/g, "(TM)")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "")
}

function pdfEscape(value: string) {
  return cleanText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

function stripMarkdown(value: string) {
  return cleanText(value)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
}

function wrapText(value: string, width = 92) {
  const lines: string[] = []
  for (const paragraph of stripMarkdown(value).split("\n")) {
    const trimmed = paragraph.trim()
    if (!trimmed) {
      lines.push("")
      continue
    }

    let line = ""
    for (const word of trimmed.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (next.length > width) {
        if (line) lines.push(line)
        line = word
      } else {
        line = next
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

async function localDownloadContent(downloadUrl: string) {
  const url = String(downloadUrl || "").trim()
  if (!url.startsWith("/resources/downloads/") || !url.endsWith(".md")) return ""

  const root = path.join(process.cwd(), "public")
  const resolved = path.normalize(path.join(root, url))
  if (!resolved.startsWith(root)) return ""

  try {
    return await fs.readFile(resolved, "utf8")
  } catch {
    return ""
  }
}

export async function buildResourcePdf(resource: ResourceRow) {
  const sourceContent = await localDownloadContent(resource.downloadUrl)
  const sections = [
    `# ${resource.title}`,
    resource.summary,
    sourceContent || resource.bodyContent,
    resource.promptText ? `## Prompt\n${resource.promptText}` : "",
    resource.useCaseText ? `## Operational Use Case\n${resource.useCaseText}` : "",
    resource.customizationNotes ? `## How to Customize\n${resource.customizationNotes}` : ""
  ].filter(Boolean)

  const lines = wrapText(sections.join("\n\n"))
  const pageLineLimit = 46
  const pages: string[][] = []
  for (let index = 0; index < lines.length; index += pageLineLimit) {
    pages.push(lines.slice(index, index + pageLineLimit))
  }
  if (!pages.length) pages.push([resource.title])

  const objects: string[] = []
  const addObject = (body: string) => {
    objects.push(body)
    return objects.length
  }

  const pageRefs: number[] = []
  const contentRefs: number[] = []

  for (const pageLines of pages) {
    const commands = [
      "BT",
      "/F1 11 Tf",
      "54 760 Td",
      "14 TL",
      ...pageLines.map((line, index) => `${index === 0 ? "" : "T*"}(${pdfEscape(line)}) Tj`),
      "ET"
    ].filter(Boolean)
    const stream = commands.join("\n")
    contentRefs.push(addObject(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`))
  }

  const pagesRef = pages.length * 2 + 1
  const fontRef = pages.length * 2 + 2
  const catalogRef = pages.length * 2 + 3

  for (const contentRef of contentRefs) {
    pageRefs.push(
      addObject(
        `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRef} 0 R >> >> /Contents ${contentRef} 0 R >>`
      )
    )
  }

  addObject(`<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`)
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
  addObject(`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`)

  const chunks = ["%PDF-1.4\n"]
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(chunks.join(""), "utf8"))
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`)
  }

  const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8")
  chunks.push(`xref\n0 ${objects.length + 1}\n`)
  chunks.push("0000000000 65535 f \n")
  for (const offset of offsets.slice(1)) {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`)
  }
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogRef} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`)

  return Buffer.from(chunks.join(""), "utf8")
}

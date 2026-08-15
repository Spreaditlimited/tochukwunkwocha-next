import fs from "node:fs"
import { PrismaClient } from "@prisma/client"

function loadDotEnv(path = ".env") {
  if (!fs.existsSync(path)) return
  for (const rawLine of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#") || !line.includes("=")) continue
    const key = line.slice(0, line.indexOf("=")).trim()
    let value = line.slice(line.indexOf("=") + 1).trim()
    if (!key || process.env[key] != null) continue
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    process.env[key] = value
  }
}

loadDotEnv()
const prisma = new PrismaClient()

const detectors = [
  ["html-comment", /<!--[\s\S]*?-->/gi],
  ["encoded-comment", /&lt;!--[\s\S]*?--&gt;/gi],
  ["markdown-filename", /[\w./-]+\.md(?::[\w-]+)?/gi],
  ["code-fence", /```(?:html|markdown|md)?/gi],
  ["markdown-heading", /(?:^|\n)\s{0,3}#{1,6}\s+[^\n<]+/g],
  ["markdown-link", /\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)/gi],
  ["markdown-bold", /\*\*[^*\n]+\*\*/g],
  ["document-wrapper", /<!doctype\s+html|<\/?(?:html|head|body)\b/gi],
  ["editor-placeholder", /\[(?:insert|add|replace|expand|write)[^\]\n]{0,120}\]/gi],
  ["editorial-label", /\b(?:top[ -]?up|editor(?:ial)? note|rewrite note|draft note|generation note)\b/gi],
  ["assistant-preamble", /\b(?:here is|here's|below is) (?:the|your|a) (?:rewritten |updated |complete )?(?:article|blog post|draft)\b/gi]
]

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function contextAround(content, index, length) {
  return compact(content.slice(Math.max(0, index - 100), Math.min(content.length, index + length + 100))).slice(0, 360)
}

async function main() {
  const posts = await prisma.tochukwuBlogPost.findMany({
    select: { pidBlog: true, blogSlug: true, blogTitle: true, blogContent: true },
    orderBy: { createdAt: "asc" }
  })
  const findings = []
  let allowedSeoFaqBoundaries = 0

  for (const post of posts) {
    const content = String(post.blogContent || "")
    for (const [kind, pattern] of detectors) {
      pattern.lastIndex = 0
      for (const match of content.matchAll(pattern)) {
        if (kind === "html-comment" && /<!-- tochukwu-seo-faq:(?:start:|end -->)/.test(match[0])) {
          allowedSeoFaqBoundaries += 1
          continue
        }
        findings.push({
          pidBlog: post.pidBlog,
          slug: post.blogSlug,
          title: post.blogTitle,
          kind,
          match: compact(match[0]).slice(0, 180),
          context: contextAround(content, match.index || 0, match[0].length)
        })
      }
    }
  }

  const requestedKind = process.argv.find((argument) => argument.startsWith("--kind="))?.slice("--kind=".length)
  const reportedFindings = requestedKind ? findings.filter((finding) => finding.kind === requestedKind) : findings

  process.stdout.write(`${JSON.stringify({
    articlesScanned: posts.length,
    articlesWithFindings: new Set(findings.map((finding) => finding.pidBlog)).size,
    allowedSeoFaqBoundaries,
    findingsByKind: Object.fromEntries(detectors.map(([kind]) => [kind, findings.filter((finding) => finding.kind === kind).length])),
    findings: process.argv.includes("--summary-only") ? undefined : reportedFindings
  }, null, 2)}\n`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())

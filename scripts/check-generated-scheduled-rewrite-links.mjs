import fs from "node:fs"

const checkpoint = JSON.parse(fs.readFileSync("/private/tmp/tochukwu-scheduled-blog-rewrites.json", "utf8"))
const usage = new Map()
for (const rewrite of Object.values(checkpoint.rewrites)) {
  for (const match of rewrite.html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)) {
    const urls = usage.get(match[1]) || []
    urls.push(rewrite.slug)
    usage.set(match[1], urls)
  }
}

const entries = [...usage.entries()]
let cursor = 0
const checks = new Array(entries.length)

async function worker() {
  while (cursor < entries.length) {
    const index = cursor++
    const [url, slugs] = entries[index]
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TochukwuTechContentAudit/1.0)" },
        signal: AbortSignal.timeout(20_000)
      })
      checks[index] = { url, status: response.status, ok: response.status < 400, finalUrl: response.url, slugs }
      await response.body?.cancel()
    } catch (error) {
      checks[index] = { url, status: 0, ok: false, error: error instanceof Error ? error.message : String(error), slugs }
    }
  }
}

await Promise.all(Array.from({ length: Math.min(8, entries.length) }, worker))
const broken = checks.filter((check) => !check.ok)
process.stdout.write(`${JSON.stringify({
  articleRewrites: Object.keys(checkpoint.rewrites).length,
  uniqueExternalLinks: checks.length,
  reachable: checks.length - broken.length,
  broken,
  checks
}, null, 2)}\n`)
if (broken.some((check) => check.status === 404 || check.status === 410)) process.exitCode = 1

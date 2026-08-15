import fs from "node:fs"

const checkpointPath = "/private/tmp/tochukwu-scheduled-blog-rewrites.json"
if (!fs.existsSync(checkpointPath)) throw new Error("Scheduled rewrite checkpoint was not found.")

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"))
const summaries = Object.values(checkpoint.rewrites).map((rewrite) => {
  const headings = [...rewrite.html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)]
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
  const links = [...rewrite.html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1])
  return {
    slug: rewrite.slug,
    words: rewrite.wordCount,
    headings: headings.length,
    internalLinks: links.filter((url) => url.startsWith("/")).length,
    externalLinks: links.filter((url) => /^https?:/i.test(url)).length,
    model: rewrite.model,
    responseRecorded: Boolean(rewrite.responseId),
    originalImageRecorded: Boolean(rewrite.originalImage),
    scheduledDate: rewrite.originalCreatedAt
  }
})

process.stdout.write(`${JSON.stringify({
  rewrites: summaries.length,
  wordCounts: {
    min: Math.min(...summaries.map((item) => item.words)),
    max: Math.max(...summaries.map((item) => item.words)),
    average: Math.round(summaries.reduce((total, item) => total + item.words, 0) / summaries.length)
  },
  headingCounts: {
    min: Math.min(...summaries.map((item) => item.headings)),
    max: Math.max(...summaries.map((item) => item.headings))
  },
  internalLinkCounts: {
    min: Math.min(...summaries.map((item) => item.internalLinks)),
    max: Math.max(...summaries.map((item) => item.internalLinks))
  },
  externalLinkCounts: {
    min: Math.min(...summaries.map((item) => item.externalLinks)),
    max: Math.max(...summaries.map((item) => item.externalLinks))
  },
  missingImages: summaries.filter((item) => !item.originalImageRecorded).map((item) => item.slug),
  missingResponseIds: summaries.filter((item) => !item.responseRecorded).map((item) => item.slug),
  articles: summaries
}, null, 2)}\n`)

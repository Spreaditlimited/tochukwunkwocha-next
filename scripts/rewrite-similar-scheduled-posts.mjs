import crypto from "node:crypto"
import fs from "node:fs"
import { PrismaClient } from "@prisma/client"

const CHECKPOINT_PATH = "/private/tmp/tochukwu-scheduled-blog-rewrites.json"
const BACKUP_PATH = "/private/tmp/tochukwu-scheduled-blog-rewrites-backup.json"
const CONCURRENCY = 3

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

function hash(value) { return crypto.createHash("sha256").update(String(value || "")).digest("hex") }
function cleanText(value) {
  return String(value || "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(?:p|h[1-6]|li|blockquote|section|article|div|tr)>/gi, ". ")
    .replace(/<br\s*\/?\s*>/gi, ". ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp|quot|apos|#39);/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}
function tokens(value) { return cleanText(value).toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || [] }
function shingles(value, size = 5) {
  const words = Array.isArray(value) ? value : tokens(value), result = new Set()
  for (let index = 0; index <= words.length - size; index += 1) result.add(words.slice(index, index + size).join(" "))
  return result
}
function sentenceSet(value) {
  return new Set(cleanText(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => tokens(sentence).join(" "))
    .filter((sentence) => sentence.split(" ").length >= 10))
}
function intersectionSize(left, right) {
  let count = 0
  const smaller = left.size <= right.size ? left : right, larger = smaller === left ? right : left
  for (const item of smaller) if (larger.has(item)) count += 1
  return count
}
function similarity(left, right) {
  const intersection = intersectionSize(left, right)
  return {
    jaccard: intersection / Math.max(1, left.size + right.size - intersection),
    containment: intersection / Math.max(1, Math.min(left.size, right.size))
  }
}
function parseJson(value) { try { return JSON.parse(value || "{}") } catch { return {} } }
function responseText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text
  return payload?.output?.flatMap((item) => item.content || []).map((item) => item.text).filter((item) => typeof item === "string").join("") || ""
}
function extractJson(value) {
  const start = value.indexOf("{"), end = value.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("Rewrite response did not contain a JSON object.")
  return JSON.parse(value.slice(start, end + 1))
}
function htmlIssues(html, approvedInternalUrls) {
  const issues = []
  const wordCount = tokens(html).length
  if (wordCount < 1100 || wordCount > 1900) issues.push(`word count ${wordCount} is outside 1,100–1,900`)
  if (!/<h2\b/i.test(html)) issues.push("no H2 sections")
  if (/<h1\b/i.test(html)) issues.push("contains an H1")
  if (/<!--[\s\S]*?-->|&lt;!--[\s\S]*?--&gt;/i.test(html)) issues.push("contains comments")
  if (/```|(?:^|\n)\s{0,3}#{1,6}\s+|\[[^\]\n]+\]\(https?:\/\//i.test(html)) issues.push("contains Markdown")
  if (/<!doctype\s+html|<\/?(?:html|head|body)\b/i.test(html)) issues.push("contains document wrappers")
  if (/utm_source=openai|turn\d+(?:search|fetch)|cite|oaicite|contentReference/i.test(html)) issues.push("contains generation or citation residue")
  if (/\[(?:insert|add|replace|expand|write)[^\]\n]{0,120}\]/i.test(html)) issues.push("contains an editor placeholder")
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const url = match[1].replace(/\/$/, "")
    if (url.startsWith("/") && !approvedInternalUrls.has(url)) issues.push(`uses unapproved internal URL ${match[1]}`)
  }
  return { issues: [...new Set(issues)], wordCount }
}

const responseSchema = {
  type: "object",
  properties: {
    html: { type: "string" },
    editorialSummary: { type: "string" }
  },
  required: ["html", "editorialSummary"],
  additionalProperties: false
}

function rewritePrompt(post, cluster, catalog) {
  const seo = { ...parseJson(post.blogExt2), ...parseJson(post.seoJson) }
  const siblingTitles = cluster.filter((item) => item.pidBlog !== post.pidBlog).map((item) => `- ${item.blogTitle}`).join("\n")
  return `Rebuild this scheduled Tochukwu Tech and AI Academy article from the ground up as a genuinely original, publication-ready article.

Article identity:
- Title: ${post.blogTitle}
- Slug: ${post.blogSlug}
- Existing excerpt: ${post.excerpt || ""}
- Focus keyword: ${seo.focusKeyword || post.blogTitle}
- Scheduled publication date: ${post.createdAt.toISOString().slice(0, 10)}

The article belongs to a catalogue where templated passages were accidentally repeated. Do not paraphrase or preserve the old template. Create a distinct outline, argument, examples, practical framework and conclusion that answer this title's specific search intent.

These neighbouring articles must remain separate; do not drift into their primary intent:
${siblingTitles}

Editorial requirements:
- Write 1,200–1,700 useful words in clear semantic HTML only. Start with paragraphs; do not add an H1 because the page already supplies it.
- Use a distinctive sequence of H2/H3 sections chosen for this topic. Do not use a generic reusable article template.
- Write primarily for readers in Nigeria while making the guidance useful internationally. Use realistic Nigerian workplace, school, professional, family or small-business examples only where relevant.
- Give concrete steps, decision criteria, examples, checklists or a framework suited to this exact topic. Avoid motivational filler and keyword stuffing.
- Preserve Tochukwu Nkwocha's practical, direct teaching voice. Explain limitations, privacy, verification and human responsibility where they are genuinely relevant, but do not paste a standard caution block.
- Do not invent facts, statistics, laws, prices, dates, employer claims, product capabilities, citations or URLs. Use web research for claims that may have changed and prefer official or primary sources.
- When an external source materially improves trust, cite it with a descriptive HTML anchor. Never output Markdown citations or OpenAI tracking parameters.
- Add two to four genuinely relevant internal links chosen only from the approved catalogue below. Use natural descriptive anchor text and do not force a course or service link.
- Do not include HTML comments, escaped comments, filenames, top-up/batch/depth markers, editor notes, assistant preambles, scripts, styles, presentational classes, FAQ boilerplate or document wrappers.
- Return only the requested JSON. The html field must contain the complete article body.

Approved internal-link catalogue:
${catalog.map((item) => `- ${item.label}: ${item.url}`).join("\n")}`
}

async function generateRewrite(post, cluster, catalog) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY.")
  const model = process.env.SEO_CONTENT_REWRITE_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-sol"
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(900_000),
    body: JSON.stringify({
      model,
      reasoning: { effort: "high" },
      tools: [{ type: "web_search" }],
      max_tool_calls: 4,
      max_output_tokens: 18_000,
      input: [
        { role: "system", content: "You are a senior human-style SEO editor. Produce original, specific, well-researched article HTML. Never reuse a generic template across titles." },
        { role: "user", content: rewritePrompt(post, cluster, catalog) }
      ],
      text: { format: { type: "json_schema", name: "scheduled_article_rewrite", schema: responseSchema, strict: true } }
    })
  })
  if (!response.ok) throw new Error(`OpenAI rewrite failed (${response.status}): ${(await response.text()).slice(0, 500)}`)
  const payload = await response.json(), content = responseText(payload)
  if (!content) throw new Error("OpenAI rewrite returned no text.")
  const parsed = extractJson(content)
  return { html: String(parsed.html || "").trim(), editorialSummary: String(parsed.editorialSummary || "").trim(), model: String(payload.model || model), responseId: String(payload.id || "") }
}

async function mapConcurrent(items, limit, worker) {
  const results = new Array(items.length)
  let cursor = 0
  async function run() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return results
}

function findClusters(scheduled) {
  const prepared = scheduled.map((post) => ({ ...post, shingles: shingles(post.blogContent), sentences: sentenceSet(post.blogContent) }))
  const adjacency = new Map(prepared.map((post) => [post.pidBlog, new Set()]))
  for (let leftIndex = 0; leftIndex < prepared.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < prepared.length; rightIndex += 1) {
      const metrics = similarity(prepared[leftIndex].shingles, prepared[rightIndex].shingles)
      const sharedSentences = intersectionSize(prepared[leftIndex].sentences, prepared[rightIndex].sentences)
      const sentenceContainment = sharedSentences / Math.max(1, Math.min(prepared[leftIndex].sentences.size, prepared[rightIndex].sentences.size))
      if (metrics.jaccard < 0.14 && metrics.containment < 0.24 && sentenceContainment < 0.18) continue
      adjacency.get(prepared[leftIndex].pidBlog).add(prepared[rightIndex].pidBlog)
      adjacency.get(prepared[rightIndex].pidBlog).add(prepared[leftIndex].pidBlog)
    }
  }
  const byPid = new Map(prepared.map((post) => [post.pidBlog, post])), visited = new Set(), clusters = []
  for (const post of prepared) {
    if (visited.has(post.pidBlog) || !adjacency.get(post.pidBlog).size) continue
    const stack = [post.pidBlog], cluster = []
    while (stack.length) {
      const pid = stack.pop()
      if (visited.has(pid)) continue
      visited.add(pid); cluster.push(byPid.get(pid))
      for (const neighbour of adjacency.get(pid)) stack.push(neighbour)
    }
    clusters.push(cluster.sort((left, right) => left.createdAt - right.createdAt))
  }
  return clusters
}

function readCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return { version: 1, rewrites: {} }
  try { return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf8")) } catch { return { version: 1, rewrites: {} } }
}
function saveCheckpoint(checkpoint) { fs.writeFileSync(CHECKPOINT_PATH, `${JSON.stringify(checkpoint, null, 2)}\n`) }

loadDotEnv()
const prisma = new PrismaClient()

async function main() {
  const mode = process.argv.includes("--generate") ? "generate" : process.argv.includes("--apply") ? "apply" : "audit"
  const now = new Date()
  const [posts, catalogRows] = await Promise.all([
    prisma.tochukwuBlogPost.findMany({
      where: { blogPublished: true },
      select: { pidBlog: true, blogSlug: true, blogTitle: true, blogContent: true, blogImage: true, excerpt: true, seoJson: true, blogExt2: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.tochukwuSeoLinkablePage.findMany({ where: { status: "active" }, select: { label: true, url: true }, orderBy: { id: "asc" } })
  ])
  const scheduled = posts.filter((post) => post.createdAt > now)
  const clusters = findClusters(scheduled), candidates = clusters.flat()
  const catalog = catalogRows.map((row) => ({ label: row.label, url: row.url.replace(/\/$/, "") }))
  const approvedInternalUrls = new Set(catalog.map((item) => item.url))
  process.stdout.write(`Identified ${candidates.length} articles in ${clusters.length} high-similarity clusters. Mode: ${mode}.\n`)

  if (mode === "audit") {
    process.stdout.write(`${JSON.stringify(clusters.map((cluster) => cluster.map((post) => ({ slug: post.blogSlug, date: post.createdAt.toISOString() }))), null, 2)}\n`)
    return
  }

  const checkpoint = readCheckpoint()
  if (mode === "generate") {
    await mapConcurrent(candidates, CONCURRENCY, async (post, index) => {
      const sourceHash = hash(post.blogContent)
      const existing = checkpoint.rewrites[post.pidBlog]
      if (existing?.sourceHash === sourceHash) {
        process.stdout.write(`[${index + 1}/${candidates.length}] Reusing ${post.blogSlug}.\n`)
        return
      }
      const cluster = clusters.find((items) => items.some((item) => item.pidBlog === post.pidBlog))
      process.stdout.write(`[${index + 1}/${candidates.length}] Rewriting ${post.blogSlug}...\n`)
      const rewrite = await generateRewrite(post, cluster, catalog)
      const validation = htmlIssues(rewrite.html, approvedInternalUrls)
      if (validation.issues.length) throw new Error(`${post.blogSlug}: ${validation.issues.join("; ")}`)
      checkpoint.rewrites[post.pidBlog] = { pidBlog: post.pidBlog, slug: post.blogSlug, sourceHash, originalImage: post.blogImage, originalCreatedAt: post.createdAt.toISOString(), ...rewrite, wordCount: validation.wordCount }
      saveCheckpoint(checkpoint)
      process.stdout.write(`[${index + 1}/${candidates.length}] Completed ${post.blogSlug} (${validation.wordCount} words).\n`)
    })
  }

  const rewrites = candidates.map((post) => checkpoint.rewrites[post.pidBlog]).filter(Boolean)
  if (rewrites.length !== candidates.length) throw new Error(`Checkpoint contains ${rewrites.length}/${candidates.length} required rewrites.`)
  for (const post of candidates) {
    const rewrite = checkpoint.rewrites[post.pidBlog]
    if (rewrite.sourceHash !== hash(post.blogContent)) throw new Error(`${post.blogSlug} changed after its rewrite was generated.`)
    const validation = htmlIssues(rewrite.html, approvedInternalUrls)
    if (validation.issues.length) throw new Error(`${post.blogSlug}: ${validation.issues.join("; ")}`)
  }

  const replacements = new Map(rewrites.map((rewrite) => [rewrite.pidBlog, rewrite.html]))
  const comparisonPosts = posts.map((post) => ({ ...post, shingles: shingles(replacements.get(post.pidBlog) || post.blogContent) }))
  const similarityFailures = []
  for (const candidate of candidates) {
    const current = comparisonPosts.find((post) => post.pidBlog === candidate.pidBlog)
    for (const other of comparisonPosts) {
      if (other.pidBlog === current.pidBlog) continue
      const metrics = similarity(current.shingles, other.shingles)
      if (metrics.jaccard >= 0.14 || metrics.containment >= 0.24) similarityFailures.push({ slug: current.blogSlug, comparedWith: other.blogSlug, jaccard: Number(metrics.jaccard.toFixed(4)), containment: Number(metrics.containment.toFixed(4)) })
    }
  }
  if (similarityFailures.length) throw new Error(`Generated rewrites still exceed similarity limits: ${JSON.stringify(similarityFailures.slice(0, 20))}`)
  process.stdout.write(`Validated ${rewrites.length} rewrites against all ${posts.length} articles with zero high-similarity pairs.\n`)

  if (mode === "apply") {
    fs.writeFileSync(BACKUP_PATH, `${JSON.stringify(candidates.map((post) => ({ pidBlog: post.pidBlog, slug: post.blogSlug, blogContent: post.blogContent, blogImage: post.blogImage, createdAt: post.createdAt.toISOString(), updatedAt: post.updatedAt.toISOString() })), null, 2)}\n`)
    const updatedAt = new Date()
    await prisma.$transaction(candidates.map((post) => prisma.tochukwuBlogPost.update({
      where: { pidBlog: post.pidBlog },
      data: { blogContent: replacements.get(post.pidBlog), updatedAt }
    })))
    process.stdout.write(`Applied ${candidates.length} rewrites. Images and publication dates were not included in the update. Backup: ${BACKUP_PATH}\n`)
  } else {
    process.stdout.write(`Generation complete. Checkpoint: ${CHECKPOINT_PATH}\n`)
  }
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1 })
  .finally(async () => prisma.$disconnect())

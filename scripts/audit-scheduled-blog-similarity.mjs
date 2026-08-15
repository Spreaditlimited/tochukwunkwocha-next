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

const entities = new Map([["amp", "&"], ["lt", "<"], ["gt", ">"], ["quot", '"'], ["apos", "'"], ["nbsp", " "]])
function decodeEntities(value) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, token) => {
    if (token[0] === "#") {
      const hexadecimal = token[1]?.toLowerCase() === "x"
      const number = Number.parseInt(token.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10)
      return Number.isFinite(number) ? String.fromCodePoint(number) : match
    }
    return entities.get(token.toLowerCase()) ?? match
  })
}

function articleText(value) {
  return decodeEntities(String(value || "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(?:p|h[1-6]|li|blockquote|section|article|div|tr)>/gi, ". ")
    .replace(/<br\s*\/?\s*>/gi, ". ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
}

function words(value) {
  return value.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || []
}

function shingles(tokens, size = 5) {
  const result = new Set()
  for (let index = 0; index <= tokens.length - size; index += 1) result.add(tokens.slice(index, index + size).join(" "))
  return result
}

function sentences(value) {
  return new Set(value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => words(sentence).join(" "))
    .filter((sentence) => sentence.split(" ").length >= 10))
}

const stopWords = new Set("a an and are as at be been being but by can could did do does for from had has have he her hers him his how i if in into is it its may might more most must no not of on or our ours she should so than that the their theirs them then there these they this those to too us was we were what when where which who why will with would you your yours ai artificial intelligence use using".split(" "))
function termVector(tokens) {
  const vector = new Map()
  for (const token of tokens) {
    if (token.length < 3 || stopWords.has(token)) continue
    vector.set(token, (vector.get(token) || 0) + 1)
  }
  return vector
}

function intersectionSize(left, right) {
  let count = 0
  const smaller = left.size <= right.size ? left : right
  const larger = smaller === left ? right : left
  for (const item of smaller) if (larger.has(item)) count += 1
  return count
}

function cosine(left, right) {
  let dot = 0, leftMagnitude = 0, rightMagnitude = 0
  for (const value of left.values()) leftMagnitude += value * value
  for (const value of right.values()) rightMagnitude += value * value
  for (const [term, value] of left) dot += value * (right.get(term) || 0)
  return leftMagnitude && rightMagnitude ? dot / Math.sqrt(leftMagnitude * rightMagnitude) : 0
}

function round(value) { return Number(value.toFixed(4)) }

function compare(left, right) {
  const shingleIntersection = intersectionSize(left.shingles, right.shingles)
  const sentenceIntersection = intersectionSize(left.sentences, right.sentences)
  const jaccard = shingleIntersection / Math.max(1, left.shingles.size + right.shingles.size - shingleIntersection)
  const containment = shingleIntersection / Math.max(1, Math.min(left.shingles.size, right.shingles.size))
  const sentenceContainment = sentenceIntersection / Math.max(1, Math.min(left.sentences.size, right.sentences.size))
  const termCosine = cosine(left.vector, right.vector)
  const highSimilarity = jaccard >= 0.14 || containment >= 0.24 || sentenceContainment >= 0.18 || (termCosine >= 0.76 && containment >= 0.12)
  const score = Math.max(jaccard, containment * 0.72, sentenceContainment * 0.85, termCosine * 0.45)
  return { highSimilarity, score, jaccard, containment, sentenceContainment, termCosine, sharedShingles: shingleIntersection, sharedSentences: sentenceIntersection }
}

function prepare(post, scheduled) {
  const text = articleText(post.blogContent)
  const tokens = words(text)
  return { ...post, scheduled, text, tokens, shingles: shingles(tokens), sentences: sentences(text), vector: termVector(tokens) }
}

loadDotEnv()
const prisma = new PrismaClient()

async function main() {
  const summaryOnly = process.argv.includes("--summary-only")
  const now = new Date()
  const posts = await prisma.tochukwuBlogPost.findMany({
    where: { blogPublished: true },
    select: { pidBlog: true, blogSlug: true, blogTitle: true, blogContent: true, createdAt: true },
    orderBy: { createdAt: "asc" }
  })
  const prepared = posts.map((post) => prepare(post, post.createdAt > now))
  const scheduled = prepared.filter((post) => post.scheduled)
  const pairs = []

  for (const futurePost of scheduled) {
    for (const otherPost of prepared) {
      if (futurePost.pidBlog === otherPost.pidBlog) continue
      if (otherPost.scheduled && otherPost.createdAt < futurePost.createdAt) continue
      const metrics = compare(futurePost, otherPost)
      if (!metrics.highSimilarity) continue
      pairs.push({
        scheduledSlug: futurePost.blogSlug,
        scheduledTitle: futurePost.blogTitle,
        scheduledDate: futurePost.createdAt.toISOString(),
        comparedWith: otherPost.blogSlug,
        comparedTitle: otherPost.blogTitle,
        comparedSet: otherPost.scheduled ? "scheduled" : "live",
        ...Object.fromEntries(Object.entries(metrics).filter(([key]) => key !== "highSimilarity").map(([key, value]) => [key, typeof value === "number" ? round(value) : value]))
      })
    }
  }
  pairs.sort((left, right) => right.score - left.score)

  const repeatedSentences = new Map()
  for (const post of scheduled) {
    for (const sentence of post.sentences) {
      const entries = repeatedSentences.get(sentence) || []
      entries.push(post.blogSlug)
      repeatedSentences.set(sentence, entries)
    }
  }
  const templateSentences = [...repeatedSentences.entries()]
    .filter(([, slugs]) => slugs.length >= 3)
    .map(([sentence, slugs]) => ({ sentence, count: slugs.length, slugs }))
    .sort((left, right) => right.count - left.count || right.sentence.length - left.sentence.length)

  process.stdout.write(`${JSON.stringify({
    auditedAt: now.toISOString(),
    totalPublishedRecords: posts.length,
    scheduledArticles: scheduled.length,
    scheduledDateRange: scheduled.length ? { from: scheduled[0].createdAt.toISOString(), to: scheduled.at(-1).createdAt.toISOString() } : null,
    wordCounts: scheduled.length ? { min: Math.min(...scheduled.map((post) => post.tokens.length)), max: Math.max(...scheduled.map((post) => post.tokens.length)), average: Math.round(scheduled.reduce((sum, post) => sum + post.tokens.length, 0) / scheduled.length) } : null,
    highSimilarityPairs: pairs.length,
    affectedScheduledArticles: new Set(pairs.flatMap((pair) => pair.comparedSet === "scheduled" ? [pair.scheduledSlug, pair.comparedWith] : [pair.scheduledSlug])).size,
    pairs: summaryOnly ? undefined : pairs,
    repeatedTemplateSentenceCount: templateSentences.length,
    repeatedTemplateSentences: summaryOnly ? undefined : templateSentences
  }, null, 2)}\n`)
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1 })
  .finally(async () => prisma.$disconnect())

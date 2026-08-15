import assert from "node:assert/strict"
import test from "node:test"

import { blogSearchTerms, estimateReadingMinutes, normalizeBlogSearchQuery, scoreBlogSearchResult } from "../lib/blog-search.ts"

test("blog search normalizes unsafe whitespace and limits terms", () => {
  assert.equal(normalizeBlogSearchQuery("  AI\u0000   training  "), "AI training")
  assert.deepEqual(blogSearchTerms("AI AI training in Nigeria"), ["ai", "training", "in", "nigeria"])
  assert.equal(blogSearchTerms("one two three four five six seven eight nine").length, 8)
})

test("blog search ranks title and SEO matches above body-only matches", () => {
  const title = scoreBlogSearchResult({ blogTitle: "AI Training in Nigeria" }, "AI training")
  const seo = scoreBlogSearchResult({ blogTitle: "A practical guide", seoJson: '{"focusKeyword":"AI training"}' }, "AI training")
  const body = scoreBlogSearchResult({ blogTitle: "A practical guide", blogContent: "<p>AI training explained.</p>" }, "AI training")
  assert.ok(title > seo)
  assert.ok(seo > body)
})

test("reading time uses article text and ignores markup", () => {
  assert.equal(estimateReadingMinutes("<h1>Short article</h1><script>ignored words here</script>"), 1)
  assert.equal(estimateReadingMinutes(Array.from({ length: 221 }, () => "word").join(" ")), 2)
})

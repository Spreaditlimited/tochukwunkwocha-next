import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const [route, blogPage, nextConfig] = await Promise.all([
  readFile(new URL("../app/(public)/blog/rss.xml/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/(public)/blog/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../next.config.ts", import.meta.url), "utf8")
])

assert.match(route, /getPublishedPosts\(100\)/)
assert.match(route, /application\/rss\+xml; charset=utf-8/)
assert.match(route, /xmlns:atom=/)
assert.match(route, /xmlns:dc=/)
assert.match(route, /xmlns:media=/)
assert.match(route, /escapeXml\(post\.blogTitle\)/)
assert.match(route, /absoluteUrl\(`\/blog\/\$\{post\.blogSlug\}`\)/)
assert.doesNotMatch(route, /localhost|127\.0\.0\.1/)
assert.match(blogPage, /"application\/rss\+xml": absoluteUrl\("\/blog\/rss\.xml"\)/)
for (const source of ["/blog/rss", "/blog/feed", "/blog/feed.xml"]) {
  assert.ok(nextConfig.includes(`"${source}"`), `Missing redirect for ${source}`)
}

console.log("Blog RSS smoke checks passed.")

import assert from "node:assert/strict"
import test from "node:test"

import { blogSearchTerms, estimateReadingMinutes, normalizeBlogSearchQuery, scoreBlogSearchResult } from "../lib/blog-search.ts"
import { assertCleanGeneratedBlogHtml, generatedBlogHtmlIssues, normalizeBlogContentForStorage, prepareBlogContentHtml } from "../lib/blog-content-html.ts"
import { readFile } from "node:fs/promises"

const blogData = await readFile(new URL("../lib/blog.ts", import.meta.url), "utf8")
const blogPage = await readFile(new URL("../app/(public)/blog/page.tsx", import.meta.url), "utf8")
const articlePage = await readFile(new URL("../app/(public)/blog/[slug]/page.tsx", import.meta.url), "utf8")
const globalStyles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8")
const blogForm = await readFile(new URL("../components/BlogPostForm.tsx", import.meta.url), "utf8")
const blogAuthor = await readFile(new URL("../components/blog/BlogAuthor.tsx", import.meta.url), "utf8")
const blogAuthorData = await readFile(new URL("../lib/blog-author.ts", import.meta.url), "utf8")
const siteSeo = await readFile(new URL("../lib/site-seo.ts", import.meta.url), "utf8")

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

test("article tables render inside an accessible responsive scroll region", () => {
  const html = prepareBlogContentHtml("<p>Before</p><table><tbody><tr><td>Cell</td></tr></tbody></table>")
  assert.match(html, /class="blog-table-scroll"/)
  assert.match(html, /role="region"/)
  assert.match(html, /tabindex="0"/)
  assert.match(articlePage, /prepareBlogContentHtml\(post\.blogContent\)/)
  assert.match(globalStyles, /\.blog-content \.blog-table-scroll[\s\S]*overflow-x-auto/)
  assert.match(globalStyles, /\.blog-content table[\s\S]*min-w-\[42rem\]/)
  assert.match(globalStyles, /\.blog-content th,[\s\S]*\.blog-content td/)
})

test("editorial import markers never reach the public article", () => {
  const escaped = "<p>Before</p><p>&lt;!-- how-to-build-a-simple-ai-powered-lead-magnet.md:topup --&gt;</p><h2>After</h2>"
  assert.equal(normalizeBlogContentForStorage(escaped), "<p>Before</p><h2>After</h2>")
  assert.doesNotMatch(prepareBlogContentHtml(escaped), /topup|\.md:/)

  const faq = "<!-- tochukwu-seo-faq:start:change-1 --><section>FAQ</section><!-- tochukwu-seo-faq:end -->"
  assert.match(normalizeBlogContentForStorage(faq), /tochukwu-seo-faq:start/)
  assert.doesNotMatch(prepareBlogContentHtml(faq), /<!--/)
})

test("generated rewrites reject comments, Markdown links and OpenAI tracking URLs", () => {
  const dirty = '<p><!-- draft --></p><p>[Source](https://example.com/?utm_source=openai)</p>'
  assert.deepEqual(generatedBlogHtmlIssues(dirty), ["editorial or HTML comments", "Markdown links", "OpenAI tracking parameters"])
  assert.throws(() => assertCleanGeneratedBlogHtml(dirty), /clean HTML-only rewrite/)
  assert.doesNotThrow(() => assertCleanGeneratedBlogHtml('<p>Read <a href="https://example.com/guide">the official guide</a>.</p>'))
})

test("article SEO metadata is rendered completely and survives later CMS edits", () => {
  assert.match(articlePage, /keywords: seo\.keywords/)
  assert.match(articlePage, /authors: \[\{ name:/)
  assert.match(articlePage, /imageAlt: seo\.imageAlt/)
  assert.match(articlePage, /alt=\{seo\.imageAlt/)
  assert.match(blogData, /existing \? parseBlogSeo\(existing\) : \{\}/)
  assert.match(blogForm, /name="imageAlt"/)
})

test("every article uses the canonical author profile, portrait and structured data", () => {
  assert.match(blogAuthorData, /name: "Tochukwu Nkwocha"/)
  assert.match(blogAuthorData, /founder of Sure Imports/)
  assert.match(blogAuthorData, /Digital Marketing Executive at a technology consulting firm/)
  assert.match(blogAuthor, /function BlogAuthorByline/)
  assert.match(blogAuthor, /function BlogAuthorCard/)
  assert.match(articlePage, /<BlogAuthorByline \/>/)
  assert.match(articlePage, /<BlogAuthorCard \/>/)
  assert.match(articlePage, /blogAuthorJsonLd\(\)/)
  assert.match(siteSeo, /"@type": "Person"/)
  assert.match(blogData, /blogBy: primaryBlogAuthor\.name/)
  assert.match(blogForm, /\{primaryBlogAuthor\.name\}/)
  assert.doesNotMatch(blogForm, /name="blogBy"/)
})

test("the public blog renders three real featured posts without duplicating them in latest articles", () => {
  assert.match(blogData, /getPublishedFeaturedPosts/)
  assert.match(blogData, /blogFeatured: true/)
  assert.match(blogData, /Math\.min\(3,/)
  assert.doesNotMatch(blogData, /published-featured-blog-posts/)
  assert.match(blogData, /!terms\.length \? \{ blogFeatured: false \}/)
  assert.match(blogPage, /getPublishedFeaturedPosts\(3\)/)
  assert.match(blogPage, /Featured Articles/)
  assert.match(blogPage, /featuredPosts\.map/)
})

test("scheduled posts stay private until their publication timestamp", () => {
  assert.match(blogData, /blogPublished: true,[\s\S]*createdAt: \{ lte: new Date\(\) \}/)
  assert.match(blogData, /includeDraft \? \{\} : \{ blogPublished: true, createdAt: \{ lte: new Date\(\) \} \}/)
})

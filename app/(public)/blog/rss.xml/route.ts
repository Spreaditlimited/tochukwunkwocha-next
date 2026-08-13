import { brand } from "@/lib/brand"
import { getBlogImageSrc, getPublishedPosts } from "@/lib/blog"
import { absoluteUrl } from "@/lib/site-seo"

export const dynamic = "force-dynamic"

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function absoluteImageUrl(value: string | null | undefined) {
  const image = getBlogImageSrc(value)
  return image ? absoluteUrl(image) : ""
}

export async function GET() {
  const posts = await getPublishedPosts(100)
  const feedUrl = absoluteUrl("/blog/rss.xml")
  const blogUrl = absoluteUrl("/blog")
  const lastBuildDate = posts[0]?.updatedAt || posts[0]?.createdAt || new Date()
  const items = posts.map((post) => {
    const articleUrl = absoluteUrl(`/blog/${post.blogSlug}`)
    const imageUrl = absoluteImageUrl(post.blogImage)
    return `
    <item>
      <title>${escapeXml(post.blogTitle)}</title>
      <link>${escapeXml(articleUrl)}</link>
      <guid isPermaLink="true">${escapeXml(articleUrl)}</guid>
      <description>${escapeXml(post.excerpt || "Read this article on Tochukwu Tech and AI Academy.")}</description>
      <dc:creator>${escapeXml(brand.personalName)}</dc:creator>
      <pubDate>${post.createdAt.toUTCString()}</pubDate>${imageUrl ? `
      <media:content url="${escapeXml(imageUrl)}" medium="image" />` : ""}
    </item>`
  }).join("")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(`${brand.name} Blog`)}</title>
    <link>${escapeXml(blogUrl)}</link>
    <description>${escapeXml("Practical insights on AI, technology, education, business, productivity, and building software.")}</description>
    <language>en-gb</language>
    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <image>
      <url>${escapeXml(absoluteUrl(brand.assets.logo))}</url>
      <title>${escapeXml(brand.name)}</title>
      <link>${escapeXml(blogUrl)}</link>
    </image>${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff"
    }
  })
}

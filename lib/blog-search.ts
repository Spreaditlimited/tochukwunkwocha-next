export function normalizeBlogSearchQuery(value: unknown) {
  return String(value || "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)
}

export function blogSearchTerms(value: unknown) {
  const query = normalizeBlogSearchQuery(value).toLocaleLowerCase("en")
  return Array.from(new Set(query.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [])).slice(0, 8)
}

export function estimateReadingMinutes(value: unknown, wordsPerMinute = 220) {
  const text = String(value || "").replace(/<!--[\s\S]*?-->/g, " ").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z0-9#]+;/gi, " ")
  const words = text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length || 0
  return Math.max(1, Math.ceil(words / Math.max(100, wordsPerMinute)))
}

export function scoreBlogSearchResult(post: {
  blogTitle?: string | null
  blogSlug?: string | null
  excerpt?: string | null
  blogContent?: string | null
  tagsJson?: string | null
  seoJson?: string | null
  blogExt2?: string | null
}, value: unknown) {
  const query = normalizeBlogSearchQuery(value).toLocaleLowerCase("en")
  const terms = blogSearchTerms(query)
  const title = `${post.blogTitle || ""} ${post.blogSlug || ""}`.toLocaleLowerCase("en")
  const seo = `${post.tagsJson || ""} ${post.seoJson || ""} ${post.blogExt2 || ""}`.toLocaleLowerCase("en")
  const excerpt = String(post.excerpt || "").toLocaleLowerCase("en")
  const content = String(post.blogContent || "").replace(/<[^>]+>/g, " ").toLocaleLowerCase("en")
  let score = title.includes(query) ? 120 : 0
  if (seo.includes(query)) score += 90
  if (excerpt.includes(query)) score += 55
  if (content.includes(query)) score += 20
  for (const term of terms) {
    if (title.includes(term)) score += 18
    if (seo.includes(term)) score += 12
    if (excerpt.includes(term)) score += 7
    if (content.includes(term)) score += 2
  }
  return score
}

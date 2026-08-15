const encodedCommentPattern = /(?:&lt;|&#0*60;|&#x0*3c;)!--[\s\S]*?--(?:&gt;|&#0*62;|&#x0*3e;)/gi
const encodedCommentParagraphPattern = /<p\b[^>]*>\s*(?:(?:&lt;|&#0*60;|&#x0*3c;)!--[\s\S]*?--(?:&gt;|&#0*62;|&#x0*3e;))\s*<\/p>/gi

export function normalizeBlogContentForStorage(value: string | null | undefined) {
  return String(value || "")
    .replace(encodedCommentParagraphPattern, "")
    .replace(encodedCommentPattern, "")
    .replace(/<!--[\s\S]*?-->/g, (comment) => comment.includes("tochukwu-seo-faq:") ? comment : "")
    .replace(/<p\b[^>]*>\s*<\/p>/gi, "")
    .trim()
}

export function generatedBlogHtmlIssues(value: string | null | undefined) {
  const html = String(value || "")
  const issues: string[] = []
  if (encodedCommentPattern.test(html) || /<!--[\s\S]*?-->/.test(html)) issues.push("editorial or HTML comments")
  encodedCommentPattern.lastIndex = 0
  if (/```(?:html|markdown|md)?/i.test(html)) issues.push("Markdown code fences")
  if (/(?:^|\n)\s{0,3}#{1,6}\s+[^\n<]+/.test(html)) issues.push("Markdown headings")
  if (/\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)/i.test(html)) issues.push("Markdown links")
  if (/<!doctype\s+html|<\/?(?:html|head|body)\b/i.test(html)) issues.push("document wrapper elements")
  if (/utm_source=openai/i.test(html)) issues.push("OpenAI tracking parameters")
  if (/\b(?:here is|here's|below is) (?:the|your|a) (?:rewritten |updated |complete )?(?:article|blog post|draft)\b/i.test(html)) issues.push("assistant preamble")
  return issues
}

export function assertCleanGeneratedBlogHtml(value: string | null | undefined) {
  const issues = generatedBlogHtmlIssues(value)
  if (issues.length) throw new Error(`Generated article HTML contains ${issues.join(", ")}. Generate a clean HTML-only rewrite before saving.`)
}

export function prepareBlogContentHtml(value: string | null | undefined) {
  return normalizeBlogContentForStorage(value).replace(/<!--[\s\S]*?-->/g, "").replace(
    /<table\b[\s\S]*?<\/table>/gi,
    (table) => `<div class="blog-table-scroll" role="region" aria-label="Scrollable article table" tabindex="0">${table}</div>`
  )
}

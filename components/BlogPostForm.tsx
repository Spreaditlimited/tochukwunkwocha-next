import { parseBlogSeo } from "@/lib/blog"
import { BlogContentEditor } from "@/components/BlogContentEditor"
import { primaryBlogAuthor } from "@/lib/blog-author"

type BlogPostFormPost = {
  pidBlog?: string
  blogTitle?: string
  blogSlug?: string
  blogContent?: string | null
  blogPublished?: boolean
  blogFeatured?: boolean
  blogImage?: string | null
  excerpt?: string | null
  tagsJson?: string | null
  seoJson?: string | null
  blogExt2?: string | null
}

export function BlogPostForm({
  post,
  pidOpportunity,
  action
}: {
  post?: BlogPostFormPost | null
  pidOpportunity?: string
  action: (formData: FormData) => Promise<void>
}) {
  const seo = post ? parseBlogSeo(post) : {}
  let tags = ""
  try {
    const parsed = JSON.parse(post?.tagsJson || "[]")
    tags = Array.isArray(parsed) ? parsed.join(", ") : ""
  } catch {}

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="pidBlog" value={post?.pidBlog || ""} />
      <input type="hidden" name="pidOpportunity" value={pidOpportunity || ""} />
      <div className="admin-card grid gap-4">
        <label>
          <span className="label">Title</span>
          <input className="field mt-1" name="blogTitle" required defaultValue={post?.blogTitle || ""} />
        </label>
        <label>
          <span className="label">Slug</span>
          <input className="field mt-1" name="blogSlug" defaultValue={post?.blogSlug || ""} />
        </label>
        <label>
          <span className="label">Excerpt</span>
          <textarea className="field mt-1 min-h-24" name="excerpt" defaultValue={post?.excerpt || ""} />
        </label>
        <BlogContentEditor defaultHtml={post?.blogContent || ""} />
      </div>

      <div className="admin-card grid gap-4 md:grid-cols-2">
        <div>
          <span className="label">Author</span>
          <p className="field mt-1 bg-muted/50 text-muted-foreground" aria-label="Author">
            {primaryBlogAuthor.name}
          </p>
        </div>
        <label>
          <span className="label">Image URL</span>
          <input className="field mt-1" name="blogImage" defaultValue={post?.blogImage || ""} />
        </label>
        <label>
          <span className="label">Tags</span>
          <input className="field mt-1" name="tags" defaultValue={tags} />
        </label>
        <div className="flex items-end gap-5 pb-2">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input name="blogPublished" type="checkbox" defaultChecked={Boolean(post?.blogPublished)} />
            Published
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input name="blogFeatured" type="checkbox" defaultChecked={Boolean(post?.blogFeatured)} />
            Featured
          </label>
        </div>
      </div>

      <div className="admin-card grid gap-4">
        <h2 className="text-lg font-bold">SEO</h2>
        <label>
          <span className="label">Meta title</span>
          <input className="field mt-1" name="metaTitle" defaultValue={seo.metaTitle || seo.seoTitle || ""} />
        </label>
        <label>
          <span className="label">Meta description</span>
          <textarea className="field mt-1 min-h-24" name="metaDescription" defaultValue={seo.metaDescription || ""} />
        </label>
        <label>
          <span className="label">Focus keyword</span>
          <input className="field mt-1" name="focusKeyword" defaultValue={seo.focusKeyword || ""} />
        </label>
        <label>
          <span className="label">Image alt text</span>
          <input className="field mt-1" name="imageAlt" defaultValue={seo.imageAlt || ""} />
        </label>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" type="submit">
          Save post
        </button>
      </div>
    </form>
  )
}

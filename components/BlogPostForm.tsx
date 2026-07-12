import { parseBlogSeo } from "@/lib/blog"

type BlogPostFormPost = {
  pidBlog?: string
  blogTitle?: string
  blogSlug?: string
  blogContent?: string | null
  blogPublished?: boolean
  blogFeatured?: boolean
  blogImage?: string | null
  blogBy?: string | null
  excerpt?: string | null
  tagsJson?: string | null
  seoJson?: string | null
  blogExt2?: string | null
}

export function BlogPostForm({
  post,
  action
}: {
  post?: BlogPostFormPost | null
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
        <label>
          <span className="label">Content HTML</span>
          <textarea className="field mt-1 min-h-[420px] font-mono text-xs" name="blogContent" required defaultValue={post?.blogContent || ""} />
        </label>
      </div>

      <div className="admin-card grid gap-4 md:grid-cols-2">
        <label>
          <span className="label">Author</span>
          <input className="field mt-1" name="blogBy" defaultValue={post?.blogBy || "Tochukwu Nkwocha"} />
        </label>
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
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" type="submit">
          Save post
        </button>
      </div>
    </form>
  )
}

import Image from "next/image"
import Link from "next/link"
import { 
  Calendar, 
  CheckCircle2, 
  Edit3, 
  FileEdit, 
  FileText, 
  ImageIcon,
  Plus, 
  Search 
} from "lucide-react"

import { getBlogImageSrc, listCmsPosts } from "@/lib/blog"
import { formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function BlogCmsPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const posts = await listCmsPosts(params.q)

  return (
    <main className="space-y-8 pb-12">
      
      {/* Header Section */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-primary">Content Management</p>
          <h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Blog Posts
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create, edit, and manage your public-facing articles and SEO content.
          </p>
        </div>
        <Link href="/internal/blog/new" className="btn-primary shrink-0 shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> New Post
        </Link>
      </div>

      {/* Search Bar */}
      <form className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input 
            className="w-full rounded-xl border border-input bg-card px-4 py-3 pl-11 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" 
            name="q" 
            defaultValue={params.q || ""} 
            placeholder="Search posts by title or slug..." 
          />
        </div>
        <button className="btn-secondary px-8 shadow-sm" type="submit">
          Search
        </button>
      </form>

      {/* Data Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[74rem] text-left text-sm whitespace-nowrap">
            <thead className="border-b border-border bg-muted/20">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Image</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Title & Slug</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lead Magnet</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date Created</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {posts.length > 0 ? (
                posts.map((post) => {
                  const imageSrc = getBlogImageSrc(post.blogImage)
                  const leadMagnet = post.leadMagnet

                  return (
                  <tr key={post.pidBlog} className="group transition-colors hover:bg-muted/5">
                    <td className="px-6 py-4">
                      <div className="relative h-16 w-28 overflow-hidden rounded-lg border border-border bg-muted/30">
                        {imageSrc ? (
                          <Image
                            src={imageSrc}
                            alt={`Cover image for ${post.blogTitle}`}
                            fill
                            sizes="112px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-heading text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                        {post.blogTitle}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        /{post.blogSlug}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {post.blogPublished ? (
                        <span className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="mr-1.5 h-3 w-3" /> Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                          <FileEdit className="mr-1.5 h-3 w-3" /> Draft
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {leadMagnet ? (
                        <div className="space-y-1">
                          <span className={leadMagnet.status === "active"
                            ? "inline-flex items-center rounded-md border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-700 dark:text-sky-300"
                            : "inline-flex items-center rounded-md border border-slate-500/20 bg-slate-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300"
                          }>
                            <FileText className="mr-1.5 h-3 w-3" />
                            {leadMagnet.status === "active" ? "Active" : "Inactive"}
                          </span>
                          <p className="max-w-[16rem] truncate text-xs font-semibold text-muted-foreground" title={leadMagnet.title}>
                            {leadMagnet.title}
                          </p>
                          {leadMagnet.pdfUrl ? (
                            <a href={leadMagnet.pdfUrl} target="_blank" rel="noreferrer" className="text-xs font-black text-primary hover:underline">
                              View PDF
                            </a>
                          ) : (
                            <p className="text-xs font-semibold text-amber-600 dark:text-amber-300">PDF missing</p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-md border border-border bg-muted/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          No lead magnet
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" /> 
                        {formatDate(post.createdAt)}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/internal/blog/${post.pidBlog}`} 
                        className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-xs font-bold text-muted-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                      >
                        <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Edit Post
                      </Link>
                    </td>
                  </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <FileText className="h-6 w-6" />
                      </div>
                      <h3 className="font-heading text-lg font-bold text-foreground">No posts found</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {params.q ? "Try adjusting your search criteria." : "Create your first blog post to get started."}
                      </p>
                      {!params.q && (
                        <Link href="/internal/blog/new" className="btn-secondary mt-6 shadow-sm">
                          <Plus className="mr-2 h-4 w-4" /> Create Post
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </main>
  )
}

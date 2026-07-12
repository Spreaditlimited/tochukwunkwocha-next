import Link from "next/link"
import { ArrowLeft, FilePenLine } from "lucide-react"

import { saveBlogPostAction } from "../../../actions"
import { BlogPostForm } from "@/components/BlogPostForm"

export default function NewBlogPostPage() {
  return (
    <main className="space-y-8 pb-12">
      
      {/* Header & Navigation */}
      <div className="flex flex-col gap-6 border-b border-border pb-6">
        <div>
          <Link 
            href="/internal/blog" 
            className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Blog CMS
          </Link>
          
          <p className="eyebrow text-primary">Content Management</p>
          <div className="mt-1 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FilePenLine className="h-5 w-5" />
            </div>
            <h1 className="font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Create New Post
            </h1>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Draft a new article, configure your SEO metadata, and publish it to the live platform.
          </p>
        </div>
      </div>

      {/* Editor Workspace Container */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <BlogPostForm action={saveBlogPostAction} />
      </div>
      
    </main>
  )
}
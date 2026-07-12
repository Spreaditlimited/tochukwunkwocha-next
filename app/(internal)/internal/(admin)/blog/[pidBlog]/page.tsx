import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, FileEdit } from "lucide-react"

import { saveBlogPostAction } from "../../../actions"
import { BlogAutomationPanel } from "@/components/BlogAutomationPanel"
import { BlogPostForm } from "@/components/BlogPostForm"
import { findPostByPid } from "@/lib/blog"

export const dynamic = "force-dynamic"

export default async function EditBlogPostPage({
  params
}: {
  params: Promise<{ pidBlog: string }>
}) {
  const { pidBlog } = await params
  const post = await findPostByPid(pidBlog)
  
  if (!post) notFound()

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
              <FileEdit className="h-5 w-5" />
            </div>
            <h1 className="font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Edit Post
            </h1>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Update content, refine SEO metadata, or manage automation triggers for <span className="font-bold text-foreground">"{post.blogTitle}"</span>.
          </p>
        </div>
      </div>

      <div className="grid gap-8">
        {/* Automation Controls */}
        <BlogAutomationPanel 
          pidBlog={post.pidBlog} 
          blogImage={post.blogImage} 
          leadMagnet={post.leadMagnet} 
        />
        
        {/* Editor Workspace Container */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <BlogPostForm post={post} action={saveBlogPostAction} />
        </div>
      </div>
      
    </main>
  )
}
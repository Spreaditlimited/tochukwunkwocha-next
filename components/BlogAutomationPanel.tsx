import Image from "next/image"
import { FileText, ImageIcon, Sparkles } from "lucide-react"

import { generateBlogImageAction, generateBlogLeadMagnetAction } from "@/app/(internal)/internal/actions"
import { getBlogImageSrc } from "@/lib/blog"

type LeadMagnet = {
  title: string
  status: string
  slug: string
  pdfUrl: string | null
}

export function BlogAutomationPanel({
  pidBlog,
  blogImage,
  leadMagnet
}: {
  pidBlog: string
  blogImage?: string | null
  leadMagnet?: LeadMagnet | null
}) {
  const imageSrc = getBlogImageSrc(blogImage)
  const active = leadMagnet?.status === "active"

  return (
    <section className="admin-card">
      <div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <p className="label">AI automation</p>
          <h2 className="mt-2 flex items-center gap-2 font-heading text-xl font-black">
            <Sparkles className="h-5 w-5 text-primary" />
            Blog image and lead magnet generation
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Generate the blog cover image with OpenAI and Cloudinary, or generate the PDF lead magnet connected to this post.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-border bg-muted/20 p-4">
          <div className="flex gap-4">
            <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-xl border border-border bg-background">
              {imageSrc ? (
                <Image src={imageSrc} alt="Current blog cover" fill sizes="144px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-7 w-7" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-heading text-lg font-black">OpenAI cover image</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Creates a new editorial image, uploads it to Cloudinary, and saves the image public id on the blog post.
              </p>
              <form action={generateBlogImageAction} className="mt-4">
                <input type="hidden" name="pidBlog" value={pidBlog} />
                <button className="btn-primary justify-center" type="submit">
                  <ImageIcon className="h-4 w-4" />
                  Generate image
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/20 p-4">
          <div className="flex gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-primary">
              <FileText className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-heading text-lg font-black">PDF lead magnet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {active
                  ? `${leadMagnet?.title} is active at /${leadMagnet?.slug}.`
                  : "Generates the lead magnet copy, PDF file, email delivery copy, and activates the offer for this post."}
              </p>
              {leadMagnet?.pdfUrl ? (
                <a href={leadMagnet.pdfUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-black text-primary">
                  View current PDF
                </a>
              ) : null}
              <form action={generateBlogLeadMagnetAction} className="mt-4">
                <input type="hidden" name="pidBlog" value={pidBlog} />
                <button className="btn-primary justify-center" type="submit">
                  <FileText className="h-4 w-4" />
                  Generate lead magnet
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

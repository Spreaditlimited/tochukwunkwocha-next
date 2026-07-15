import { Play } from "lucide-react"

export function ResourceVideoThumbnail({
  title,
  className = ""
}: {
  title: string
  className?: string
}) {
  return (
    <div className={`relative flex aspect-[16/10] overflow-hidden bg-[#0d4f9a] text-white ${className}`}>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.11)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.11)_1px,transparent_1px)] bg-[size:22px_22px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.22),transparent_22rem),linear-gradient(135deg,#0d4f9a,#063f7d)]" />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <p className="min-w-0 truncate font-mono text-[10px] font-black uppercase tracking-widest text-white/80">
            YouTube Video
          </p>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white text-[#0d4f9a] shadow-lg shadow-black/20">
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          </span>
        </div>

        <div className="max-w-[92%]">
          <p className="mb-3 inline-flex rounded-md border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white/85">
            Video
          </p>
          <h3 className="line-clamp-3 font-heading text-xl font-black leading-tight text-white sm:text-2xl">
            {title}
          </h3>
        </div>
      </div>
    </div>
  )
}

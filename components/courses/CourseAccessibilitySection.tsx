import type { ReactNode } from "react"
import { Accessibility, Captions, FileText, RotateCcw } from "lucide-react"

const supportItems = [
  { label: "Professional captions", icon: Captions },
  { label: "Written transcripts", icon: FileText },
  { label: "Self-paced review", icon: RotateCcw }
]

export function CourseAccessibilitySection({ courseName }: { courseName: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-background py-20 lg:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.45)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.45)_1px,transparent_1px)] bg-[size:32px_32px] opacity-30" />
      <div className="site-container relative">
        <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Accessibility className="h-7 w-7" />
            </div>
            <p className="eyebrow mt-8">Accessible Learning</p>
            <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
              Learning Designed for Everyone
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Learning is easier when you can engage with content in the way that works best for you.
            </p>
          </div>

          <div className="surface-raised bg-card p-6 sm:p-8">
            <div className="grid gap-3 sm:grid-cols-3">
              {supportItems.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="rounded-lg border border-border bg-muted/30 p-4">
                    <Icon className="h-5 w-5 text-primary" />
                    <p className="mt-4 text-sm font-bold leading-5 text-foreground">{item.label}</p>
                  </div>
                )
              })}
            </div>

            <div className="mt-8 space-y-5 text-base leading-relaxed text-muted-foreground">
              <p>
                Every recorded lesson in {courseName} includes professionally prepared captions and written transcripts, allowing learners to follow along more comfortably, revisit important concepts, and learn at their own pace.
              </p>
              <p>
                These accessibility features benefit many different learners, including those who are deaf or hard of hearing, people who prefer reading while watching, learners studying in noisy environments, and anyone who wants a simple way to review key ideas after class.
              </p>
              <p className="rounded-lg border border-primary/20 bg-primary/10 p-5 font-bold text-foreground">
                We believe practical AI education should be accessible, flexible, and designed to help every learner succeed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

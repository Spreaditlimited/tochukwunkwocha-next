import Image from "next/image"
import Link from "next/link"

import { brand } from "@/lib/brand"
import { cn } from "@/lib/utils"

type BrandMarkProps = {
  href?: string
  context?: "public" | "student" | "school" | "internal"
  className?: string
  showWordmark?: boolean
  variant?: "compact" | "full"
  tone?: "default" | "reverse" | "auto"
}

const contextLabels = {
  public: brand.promise,
  student: "Student Workspace",
  school: "School Workspace",
  internal: "Internal Console"
}

export function BrandMark({
  href = "/",
  context = "public",
  className,
  showWordmark = true,
  variant = "compact",
  tone = "default"
}: BrandMarkProps) {
  if (variant === "full") {
    const src = tone === "reverse" ? brand.assets.logoReverse : brand.assets.logo

    return (
      <Link
        href={href}
        className={cn("brand-focus inline-flex min-w-0 items-center no-underline", className)}
        aria-label={brand.name}
      >
        {tone === "auto" ? (
          <>
            <Image
              src={brand.assets.logo}
              alt={brand.name}
              width={2127}
              height={499}
              className="h-full w-full object-contain dark:hidden"
              priority
            />
            <Image
              src={brand.assets.logoReverse}
              alt={brand.name}
              width={2127}
              height={499}
              className="hidden h-full w-full object-contain dark:block"
              priority
            />
          </>
        ) : (
          <Image
            src={src}
            alt={brand.name}
            width={2127}
            height={499}
            className="h-full w-full object-contain"
            priority
          />
        )}
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className={cn("group inline-flex min-w-0 items-center gap-3 no-underline", className)}
      aria-label={brand.name}
    >
      <span className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-brand-ink">
        <Image
          src={brand.assets.icon}
          alt=""
          fill
          sizes="40px"
          className="object-cover"
          priority
        />
      </span>
      {showWordmark ? (
        <span className="min-w-0">
          <span className="block truncate text-sm font-black leading-5 tracking-normal text-foreground">
            {brand.shortName}
          </span>
          <span className="block truncate text-xs font-semibold leading-4 text-muted-foreground">
            {contextLabels[context]}
          </span>
        </span>
      ) : null}
    </Link>
  )
}

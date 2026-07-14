"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTransition, type FormEvent, type ReactNode } from "react"

export function ScrollPreservingGetForm({ children, className }: { children: ReactNode; className?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const currentSearchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextSearchParams = new URLSearchParams(currentSearchParams.toString())
    const formData = new FormData(event.currentTarget)

    for (const [key, value] of formData.entries()) {
      if (typeof value !== "string") continue
      if (value) nextSearchParams.set(key, value)
      else nextSearchParams.delete(key)
    }

    startTransition(() => {
      const query = nextSearchParams.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }

  return (
    <form className={className} onSubmit={submit} aria-busy={isPending}>
      {children}
    </form>
  )
}

"use client"

import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"

type SubmitButtonProps = {
  children: React.ReactNode
  pendingText?: string
  className?: string
  disabled?: boolean
  name?: string
  value?: string
}

export function SubmitButton({
  children,
  pendingText = "Working...",
  className,
  disabled,
  name,
  value
}: SubmitButtonProps) {
  const { pending } = useFormStatus()
  return (
    <button
      className={className}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      name={name}
      value={value}
      data-progress-label={pendingText}
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  )
}

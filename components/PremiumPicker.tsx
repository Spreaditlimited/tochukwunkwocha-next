import type { SelectHTMLAttributes } from "react"
import { ChevronDown } from "lucide-react"

type PickerOption = {
  label: string
  value: string
  disabled?: boolean
}

type PremiumPickerProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  options: PickerOption[]
  placeholder?: string
  tone?: "default" | "dark"
}

export function PremiumPicker({
  options,
  placeholder,
  tone = "default",
  className = "",
  defaultValue,
  value,
  ...props
}: PremiumPickerProps) {
  const selectClassName =
    tone === "dark"
      ? "h-12 w-full appearance-none rounded-lg border border-white/10 bg-white/5 px-4 pr-12 text-sm font-semibold text-white shadow-sm outline-none transition hover:border-sky-400/40 hover:bg-white/10 focus:border-sky-400 focus:bg-white/10 focus:shadow-[0_0_0_4px_rgba(56,189,248,0.12)]"
      : "brand-focus h-12 w-full appearance-none rounded-lg border border-border bg-card px-4 pr-12 text-sm font-semibold text-foreground shadow-sm outline-none transition hover:border-primary/40 hover:bg-background focus:border-primary focus:bg-background focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
  const chevronClassName =
    tone === "dark"
      ? "pointer-events-none absolute inset-y-1.5 right-1.5 flex w-9 items-center justify-center rounded-md border border-white/10 bg-white/10 text-slate-300 shadow-sm"
      : "pointer-events-none absolute inset-y-1.5 right-1.5 flex w-9 items-center justify-center rounded-md border border-border/70 bg-muted/70 text-muted-foreground shadow-sm"

  return (
    <div className={`relative ${className}`}>
      <select
        {...props}
        value={value}
        defaultValue={value === undefined ? defaultValue ?? (placeholder ? "" : undefined) : undefined}
        className={selectClassName}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <div className={chevronClassName}>
        <ChevronDown className="h-4 w-4" />
      </div>
    </div>
  )
}

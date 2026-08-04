"use client"

import { useRouter } from "next/navigation"

import { PremiumPicker } from "@/components/PremiumPicker"

type ModuleOption = {
  id: string
  courseSlug: string
  label: string
}

function moduleValue(module: ModuleOption) {
  return `${module.courseSlug}:${module.id}`
}

export function ModuleBuilderSelector({
  value,
  modules
}: {
  value: string
  modules: ModuleOption[]
}) {
  const router = useRouter()

  function selectModule(nextValue: string) {
    const query = new URLSearchParams(window.location.search)
    if (nextValue === "new") {
      query.delete("moduleId")
      query.delete("moduleCourse")
      query.set("moduleMode", "new")
    } else {
      const selected = modules.find((module) => moduleValue(module) === nextValue)
      query.delete("moduleMode")
      if (!selected) return
      query.set("moduleId", selected.id)
      if (selected?.courseSlug) {
        query.set("course", selected.courseSlug)
        query.set("moduleCourse", selected.courseSlug)
      }
    }
    router.push(`/internal/video-library?${query.toString()}#module-builder`)
  }

  return (
    <PremiumPicker
      aria-label="Select an existing module or create a new module"
      value={value}
      onChange={(event) => selectModule(event.target.value)}
      options={[
        { value: "new", label: "+ Create new module" },
        ...modules.map((module) => ({
          key: moduleValue(module),
          value: moduleValue(module),
          label: module.label
        }))
      ]}
    />
  )
}

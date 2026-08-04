"use client"

import { useEffect, useState } from "react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { ModuleBatchRulesClient } from "./ModuleBatchRulesClient"

type BatchOption = {
  batchKey: string
  batchLabel: string
  batchStartAt: string
  status: string
}

type CourseOption = {
  courseSlug: string
  courseTitle: string
  enrollmentMode: string
  batches: BatchOption[]
}

type ScheduleRow = {
  batchKey: string
  accessMode: string
  dripAt: string
}

const COURSE_CHANGE_EVENT = "tochukwu:video-library-module-course-change"

export function ModuleCoursePicker({
  courses,
  initialCourseSlug
}: {
  courses: CourseOption[]
  initialCourseSlug: string
}) {
  const [courseSlug, setCourseSlug] = useState(initialCourseSlug)

  function changeCourse(nextCourseSlug: string) {
    setCourseSlug(nextCourseSlug)
    window.dispatchEvent(new CustomEvent(COURSE_CHANGE_EVENT, { detail: nextCourseSlug }))
  }

  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Course</span>
      <PremiumPicker
        name="courseSlug"
        value={courseSlug}
        onChange={(event) => changeCourse(event.target.value)}
        options={[
          { value: "", label: "Select course" },
          ...courses.map((course) => ({ value: course.courseSlug, label: course.courseTitle }))
        ]}
      />
    </label>
  )
}

export function ModuleBatchAccessFields({
  courses,
  initialCourseSlug,
  schedules,
  initialEnabled
}: {
  courses: CourseOption[]
  initialCourseSlug: string
  schedules: ScheduleRow[]
  initialEnabled: boolean
}) {
  const [courseSlug, setCourseSlug] = useState(initialCourseSlug)
  const selectedCourse = courses.find((course) => course.courseSlug === courseSlug) || null
  const isOriginalCourse = courseSlug === initialCourseSlug
  const immediateAccess = selectedCourse?.enrollmentMode === "immediate"

  useEffect(() => {
    const handleCourseChange = (event: Event) => {
      setCourseSlug(String((event as CustomEvent<string>).detail || ""))
    }
    window.addEventListener(COURSE_CHANGE_EVENT, handleCourseChange)
    return () => window.removeEventListener(COURSE_CHANGE_EVENT, handleCourseChange)
  }, [])

  return (
    <ModuleBatchRulesClient
      key={courseSlug || "no-course"}
      batches={selectedCourse?.batches || []}
      schedules={isOriginalCourse ? schedules : []}
      initialEnabled={isOriginalCourse ? initialEnabled : false}
      disabled={Boolean(immediateAccess)}
    />
  )
}

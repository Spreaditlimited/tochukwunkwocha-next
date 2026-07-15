import Link from "next/link"
import { ArrowLeft, LockKeyhole } from "lucide-react"

import {
  EmptyStudentState,
  StudentDashboardShell
} from "@/components/student-dashboard/StudentDashboardShell"
import { CoursePlayer } from "@/components/student-dashboard/player/CoursePlayer"
import { getLearningCourseForStudent } from "@/lib/learning-player"
import { listStudentCourses } from "@/lib/student-dashboard"
import { requireStudent } from "@/lib/student-auth"
import { formatDateTimeWAT, watWallDateTimeMs } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function StudentCoursePlayerPage({
  searchParams
}: {
  searchParams?: Promise<{ course?: string; lesson?: string }>
}) {
  const session = await requireStudent()
  const params = searchParams ? await searchParams : {}
  const courseSlug = String(params.course || "").trim().toLowerCase()
  const lessonId = Number(params.lesson || 0)
  const enrolledCourses = courseSlug
    ? await listStudentCourses(session.account.email, session.account.id)
    : []
  const activeEnrollments = enrolledCourses.filter((course) => course.courseSlug === courseSlug && course.isActive)
  const lockedEnrollment = activeEnrollments
    .filter((course) => {
      if (!course.courseStartAt) return false
      const startMs = watWallDateTimeMs(course.courseStartAt)
      return Number.isFinite(startMs) && startMs > Date.now()
    })
    .sort((left, right) => {
      const leftTime = watWallDateTimeMs(left.courseStartAt)
      const rightTime = watWallDateTimeMs(right.courseStartAt)
      return leftTime - rightTime
    })[0] || null
  const hasStartedActiveEnrollment = activeEnrollments.some((course) => {
    if (!course.courseStartAt) return true
    const startMs = watWallDateTimeMs(course.courseStartAt)
    return Number.isFinite(startMs) && startMs <= Date.now()
  })
  const shouldLockPlayer = Boolean(courseSlug && lockedEnrollment && !hasStartedActiveEnrollment)
  const lockedStartLabel = lockedEnrollment?.courseStartAt ? formatDateTimeWAT(lockedEnrollment.courseStartAt) : ""
  const lockedFirstLessonLabel = lockedEnrollment?.firstRecordedLessonAvailableAt
    ? formatDateTimeWAT(lockedEnrollment.firstRecordedLessonAvailableAt)
    : ""

  const payload = courseSlug && !shouldLockPlayer
    ? await getLearningCourseForStudent({
        accountId: session.account.id,
        email: session.account.email,
        courseSlug
      })
    : null

  return (
    <StudentDashboardShell 
      account={session.account} 
      active="courses" 
      title={payload?.ok ? payload.course.courseTitle : "Interactive Player"}
      eyebrow="Learning Workspace"
    >
      <div className="flex h-full flex-col gap-6">
        
        {/* Clean, unobtrusive back navigation */}
        <div>
          <Link 
            href="/dashboard/courses" 
            className="group inline-flex w-fit items-center text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" /> 
            Back to Courses
          </Link>
        </div>

        {payload?.ok ? (
          /* Directly mount the player so its native split-pane layout can span the container naturally */
          <div className="w-full flex-1">
            <CoursePlayer
              course={payload.course}
              initialLessonId={Number.isFinite(lessonId) && lessonId > 0 ? Math.trunc(lessonId) : undefined}
              learner={{
                fullName: session.account.fullName,
                email: session.account.email
              }}
            />
          </div>
        ) : (
          /* Standardized empty state matching the rest of the dashboard */
          <div className="mt-4">
            <EmptyStudentState
              icon="lock"
              title={shouldLockPlayer ? "Course starts soon" : courseSlug ? "Course access not found" : "Choose a course"}
              description={
                shouldLockPlayer
                  ? `This button unlocks on ${lockedStartLabel}.${lockedFirstLessonLabel ? ` Your first recorded lesson will become available in the course player on ${lockedFirstLessonLabel}.` : ""}`
                  : payload && !payload.ok
                    ? payload.error
                    : "Open a course from your courses page to launch the interactive player."
              }
              action={
                <Link href="/dashboard/courses" className="btn-primary">
                  Return to Courses
                </Link>
              }
            />
          </div>
        )}

      </div>
    </StudentDashboardShell>
  )
}

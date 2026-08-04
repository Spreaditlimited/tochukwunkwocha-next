"use client"

import { Download } from "lucide-react"

import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"

export function CourseWorkbookDownloadLink({
  href,
  title
}: {
  href: string
  title: string
}) {
  return (
    <a
      href={href}
      className="btn-primary mt-5 w-full shadow-sm"
      onClick={() => {
        showStudentToast({
          type: "info",
          title: "Preparing workbook",
          message: `${title} will download securely in a moment.`
        })
      }}
    >
      <Download className="mr-2 h-4 w-4" />
      Download
    </a>
  )
}

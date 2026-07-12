import { schoolStudentsCsvTemplate } from "@/lib/school-dashboard"

export async function GET() {
  return new Response(schoolStudentsCsvTemplate(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="school-students-template.csv"'
    }
  })
}

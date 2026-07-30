import http from "k6/http"
import { check, sleep } from "k6"

const baseUrl = String(__ENV.BASE_URL || "http://localhost:3000").replace(/\/+$/, "")
const sessionCookie = String(__ENV.STUDENT_SESSION_COOKIE || "")
const lessonId = Number(__ENV.LESSON_ID || 0)

export const options = {
  scenarios: {
    student_learning: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 25 },
        { duration: "5m", target: 25 },
        { duration: "2m", target: 100 },
        { duration: "5m", target: 100 },
        { duration: "2m", target: 0 }
      ],
      gracefulRampDown: "30s"
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500", "p(99)<3000"]
  }
}

const headers = {
  "Content-Type": "application/json",
  Cookie: `tws_student_session=${sessionCookie}`
}

export function setup() {
  if (!sessionCookie) throw new Error("STUDENT_SESSION_COOKIE is required.")
  if (!Number.isFinite(lessonId) || lessonId <= 0) throw new Error("LESSON_ID must be a positive number.")
}

export default function () {
  const dashboard = http.get(`${baseUrl}/dashboard/courses`, { headers })
  check(dashboard, {
    "course dashboard succeeds": (response) => response.status === 200
  })

  const playback = http.post(
    `${baseUrl}/api/student/learning/playback`,
    JSON.stringify({ lessonId }),
    { headers }
  )
  check(playback, {
    "playback authorization succeeds": (response) => response.status === 200
  })

  sleep(60)

  const progress = http.post(
    `${baseUrl}/api/student/learning/progress`,
    JSON.stringify({ lessonId, watchSeconds: 60 }),
    { headers }
  )
  check(progress, {
    "progress save succeeds": (response) => response.status === 200
  })
}

/** Deliberately selected completed cohorts. Never infer instant access from an old date alone. */
export const SELF_PACED_COHORTS = [
  {
    courseSlug: "prompt-to-profit",
    batchKey: "ptp-batch-4-self-paced",
    sourceBatchKey: "ptp-batch-4",
    label: "Instant access · September 2026 recordings",
    completedAfter: "2026-09-26T00:00:00+01:00",
    minimumLessons: 38
  },
  {
    courseSlug: "prompt-to-production",
    batchKey: "ptpprod-batch-2-self-paced",
    sourceBatchKey: "ptpprod-batch-2",
    label: "Instant access · October 2026 recordings",
    completedAfter: "2026-11-02T00:00:00+01:00",
    minimumLessons: 46
  }
] as const

export function selfPacedCohort(courseSlug: unknown, batchKey: unknown) {
  return SELF_PACED_COHORTS.find((cohort) => cohort.courseSlug === courseSlug && cohort.batchKey === batchKey) || null
}

export function isSelfPacedCohort(courseSlug: unknown, batchKey: unknown) {
  return Boolean(selfPacedCohort(courseSlug, batchKey))
}

export function curriculumBatchKey(courseSlug: string, batchKey: string) {
  return selfPacedCohort(courseSlug, batchKey)?.sourceBatchKey || batchKey
}

export const SELF_PACED_ACCESS_MESSAGE = "Learn at your own pace with all lessons and available class recordings, and no daily lesson emails or automated learning reminders."

export function selfPacedPaymentMessage(provider: string) {
  if (provider === "manual_transfer") return "All lessons unlock as soon as your bank transfer is approved. Submitting payment proof does not unlock the course."
  if (provider === "installment") return "All lessons unlock when your installment plan is fully paid. The first installment does not unlock the course."
  return "All lessons unlock immediately after your payment is confirmed."
}

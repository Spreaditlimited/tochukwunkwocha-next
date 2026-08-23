type CohortBatch = {
  batchStartAt?: string | null
}

function batchMonth(value: string | null | undefined) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-\d{2}/)
  if (!match) return null
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) return null
  return {
    timestamp: Date.UTC(year, monthIndex, 1),
    label: new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" })
      .format(new Date(Date.UTC(year, monthIndex, 1)))
  }
}

export function cohortEnrollmentLabel(batches: CohortBatch[]) {
  const nextMonth = batches
    .map((batch) => batchMonth(batch.batchStartAt))
    .filter((month): month is NonNullable<typeof month> => Boolean(month))
    .sort((left, right) => left.timestamp - right.timestamp)[0]

  return nextMonth ? `${nextMonth.label} Cohort Now Enrolling` : "Cohort Now Enrolling"
}

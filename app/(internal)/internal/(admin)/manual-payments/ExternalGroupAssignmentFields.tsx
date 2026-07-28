"use client"

import { Plus, Trash2, UsersRound } from "lucide-react"
import { useMemo, useState } from "react"

import { PremiumPicker } from "@/components/PremiumPicker"

type LearnerRow = {
  fullName: string
  email: string
  age: string
  classLevel: string
}

const inputClass =
  "h-12 w-full rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm outline-none transition hover:border-primary/40 hover:bg-background focus:border-primary focus:bg-background focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
const labelClass = "mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground"

function emptyLearner(): LearnerRow {
  return { fullName: "", email: "", age: "", classLevel: "" }
}

export function ExternalGroupAssignmentFields() {
  const [buyerType, setBuyerType] = useState<"student" | "family">("student")
  const [seatCount, setSeatCount] = useState(1)
  const [assignNow, setAssignNow] = useState(false)
  const [learners, setLearners] = useState<LearnerRow[]>([emptyLearner()])

  const serializedLearners = useMemo(
    () => JSON.stringify(assignNow && buyerType === "family" ? learners : []),
    [assignNow, buyerType, learners]
  )

  function selectBuyerType(value: string) {
    const next = value === "family" ? "family" : "student"
    setBuyerType(next)
    if (next === "family") setSeatCount((current) => Math.max(2, current))
    else {
      setSeatCount(1)
      setAssignNow(false)
      setLearners([emptyLearner()])
    }
  }

  function changeSeatCount(value: number) {
    const minimum = buyerType === "family" ? 2 : 1
    const next = Math.max(minimum, Math.min(500, Number.isFinite(value) ? Math.round(value) : minimum))
    setSeatCount(next)
    setLearners((current) => current.slice(0, next))
  }

  function updateLearner(index: number, key: keyof LearnerRow, value: string) {
    setLearners((current) => current.map((learner, learnerIndex) => (
      learnerIndex === index ? { ...learner, [key]: value } : learner
    )))
  }

  function addLearner() {
    setLearners((current) => current.length >= seatCount ? current : [...current, emptyLearner()])
  }

  return (
    <>
      <label className="block">
        <span className={labelClass}>Buyer Type</span>
        <PremiumPicker
          name="buyerType"
          value={buyerType}
          onChange={(event) => selectBuyerType(event.target.value)}
          options={[
            { value: "student", label: "Single Learner" },
            { value: "family", label: "Family / Group" }
          ]}
        />
      </label>
      <label className="block">
        <span className={labelClass}>Seats</span>
        <input
          name="seatCount"
          type="number"
          min={buyerType === "family" ? 2 : 1}
          max="500"
          step="1"
          value={seatCount}
          onChange={(event) => changeSeatCount(Number(event.target.value))}
          className={inputClass}
        />
      </label>

      <input type="hidden" name="groupLearnersJson" value={serializedLearners} />

      {buyerType === "family" ? (
        <section className="overflow-hidden rounded-xl border border-primary/20 bg-primary/5 md:col-span-2 xl:col-span-4">
          <div className="flex flex-col gap-4 border-b border-primary/15 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UsersRound className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-heading text-base font-black text-foreground">Assign learners now</h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Optional. Assign up to {seatCount} learner {seatCount === 1 ? "seat" : "seats"} now. Any remaining seats stay available for the parent.
                </p>
              </div>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm font-bold text-foreground shadow-sm">
              <input
                type="checkbox"
                checked={assignNow}
                onChange={(event) => setAssignNow(event.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              Assign now
            </label>
          </div>

          {assignNow ? (
            <div className="space-y-4 p-5">
              {learners.map((learner, index) => (
                <article key={index} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-widest text-primary">Learner {index + 1}</p>
                    {learners.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setLearners((current) => current.filter((_, learnerIndex) => learnerIndex !== index))}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 text-destructive transition hover:bg-destructive/10"
                        aria-label={`Remove learner ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label>
                      <span className={labelClass}>Full name</span>
                      <input value={learner.fullName} onChange={(event) => updateLearner(index, "fullName", event.target.value)} className={inputClass} required={assignNow} />
                    </label>
                    <label>
                      <span className={labelClass}>Email address</span>
                      <input value={learner.email} onChange={(event) => updateLearner(index, "email", event.target.value)} type="email" className={inputClass} placeholder="Optional" />
                    </label>
                    <label>
                      <span className={labelClass}>Age</span>
                      <input value={learner.age} onChange={(event) => updateLearner(index, "age", event.target.value)} className={inputClass} placeholder="Optional" />
                    </label>
                    <label>
                      <span className={labelClass}>Class or level</span>
                      <input value={learner.classLevel} onChange={(event) => updateLearner(index, "classLevel", event.target.value)} className={inputClass} placeholder="Optional" />
                    </label>
                  </div>
                </article>
              ))}
              <button
                type="button"
                onClick={addLearner}
                disabled={learners.length >= seatCount}
                className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add another learner ({learners.length}/{seatCount})
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  )
}

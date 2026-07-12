"use client"

import { useState } from "react"

type BatchOption = {
  batchKey: string
  batchLabel: string
  batchStartAt: string
  status: string
}

type ScheduleRow = {
  rowId: string
  batchKey: string
  accessMode: string
  dripAt: string
}

type InitialScheduleRow = Omit<ScheduleRow, "rowId">

function formatDripAt12Hour(value: string) {
  const raw = String(value || "").trim()
  if (!raw) return "No drip time selected"
  const date = new Date(raw.length === 16 ? `${raw}:00` : raw)
  if (!Number.isFinite(date.getTime())) return "Time unavailable"
  let hour = date.getHours()
  const minute = String(date.getMinutes()).padStart(2, "0")
  const suffix = hour >= 12 ? "PM" : "AM"
  hour %= 12
  if (hour === 0) hour = 12
  return `Opens at ${hour}:${minute} ${suffix}`
}

function createScheduleRow(row?: Partial<InitialScheduleRow>, index = 0): ScheduleRow {
  return {
    rowId: `${row?.batchKey || "new"}-${index}-${Math.random().toString(36).slice(2)}`,
    batchKey: row?.batchKey || "",
    accessMode: row?.accessMode === "drip" ? "drip" : "immediate",
    dripAt: row?.dripAt || ""
  }
}

export function ModuleBatchRulesClient({
  batches,
  schedules,
  initialEnabled,
  disabled
}: {
  batches: BatchOption[]
  schedules: InitialScheduleRow[]
  initialEnabled: boolean
  disabled: boolean
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [rows, setRows] = useState<ScheduleRow[]>(() => schedules.map((row, index) => createScheduleRow(row, index)))

  function updateRow(index: number, patch: Partial<ScheduleRow>) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_row, rowIndex) => rowIndex !== index))
  }

  return (
    <div className="space-y-3 md:col-span-2">
      <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-muted/20 p-4">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            name="dripEnabled"
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
          />
          Batch access control
        </label>
        {disabled ? <span className="text-xs font-bold text-muted-foreground">Immediate-access course: all active modules/lessons are accessible.</span> : null}
      </div>

      {enabled && !disabled ? (
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Batch Access Rules</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Use Immediate access to make all active lessons in this module available to a batch right away. Use Drip by date when the module should unlock later.
              </p>
            </div>
            <span className="rounded-md bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
              {batches.length} batches
            </span>
          </div>
          <div className="mt-4 overflow-x-auto pb-1">
            <div className="space-y-2">
              {rows.length ? rows.map((row, index) => {
                const isImmediate = row.accessMode === "immediate"
                return (
                  <div key={row.rowId} className="grid min-w-[60rem] gap-2 sm:grid-cols-12">
                    <div className="sm:col-span-4">
                      <select
                        name="dripBatchKey"
                        value={row.batchKey}
                        onChange={(event) => updateRow(index, { batchKey: event.target.value })}
                        className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Select batch</option>
                        {batches.map((batch) => (
                          <option key={batch.batchKey} value={batch.batchKey}>
                            {batch.batchLabel || batch.batchKey}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs font-semibold text-foreground sm:col-span-3">
                      <input
                        type="checkbox"
                        checked={isImmediate}
                        onChange={(event) => updateRow(index, { accessMode: event.target.checked ? "immediate" : "drip" })}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <input type="hidden" name="dripAccessMode" value={isImmediate ? "immediate" : "drip"} />
                      <span className="truncate">Immediate access</span>
                    </label>
                    <div className="sm:col-span-4">
                      <input type="hidden" name="dripAt" value={isImmediate ? "" : row.dripAt} />
                      <input
                        type="datetime-local"
                        value={row.dripAt}
                        disabled={isImmediate}
                        onChange={(event) => updateRow(index, { dripAt: event.target.value, accessMode: event.target.value ? "drip" : row.accessMode })}
                        className={`w-full rounded-lg border border-input px-3 py-2 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary ${isImmediate ? "bg-muted text-muted-foreground" : "bg-card text-foreground"}`}
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {isImmediate ? "Immediate access enabled" : formatDripAt12Hour(row.dripAt)}
                      </p>
                    </div>
                    <div className="sm:col-span-1">
                      <button type="button" onClick={() => removeRow(index)} className="w-full rounded-lg border border-input bg-card px-2 py-2 text-xs font-semibold text-foreground hover:bg-muted/40">
                        X
                      </button>
                    </div>
                  </div>
                )
              }) : (
                <p className="text-xs text-muted-foreground">No batch access rules added yet.</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRows((current) => [...current, createScheduleRow(undefined, current.length)])}
            className="btn-secondary mt-3 h-9 px-3 text-xs"
          >
            Add batch rule
          </button>
        </div>
      ) : null}
    </div>
  )
}

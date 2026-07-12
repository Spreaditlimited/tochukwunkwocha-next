import { 
  Activity,
  AlertTriangle,
  Globe,
  Laptop,
  MonitorSmartphone, 
  RotateCcw, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  Smartphone 
} from "lucide-react"

import { prisma } from "@/lib/prisma"
import { formatDate } from "@/lib/utils"
import { resetSecurityStudentDevicesAction } from "./actions"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type CountRow = { total: number | bigint | null }

function param(params: Record<string, string | string[] | undefined>, key: string, fallback = "") {
  const value = params[key]
  return Array.isArray(value) ? value[0] || fallback : value || fallback
}

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function toInt(value: unknown) {
  const numberValue = Number(value || 0)
  return Number.isFinite(numberValue) ? Math.round(numberValue) : 0
}

async function firstCount(promise: Promise<CountRow[]>) {
  const rows = await promise.catch(() => [{ total: 0 }])
  return toInt(rows[0]?.total)
}

function severityTone(severity: string | null) {
  const raw = clean(severity, 30).toLowerCase()
  if (raw === "high" || raw === "critical") return "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
  if (raw === "medium" || raw === "elevated") return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
  return "border-border bg-muted text-muted-foreground"
}

async function getSecurityData(search: string) {
  const query = clean(search, 160).toLowerCase()
  const like = `%${query.replace(/\s+/g, "%")}%`
  const [
    trustedDevices,
    activeSessions,
    openAlerts,
    highAlerts,
    deviceRows,
    alertRows
  ] = await Promise.all([
    firstCount(prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) AS total FROM student_account_devices`),
    firstCount(prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) AS total FROM student_sessions WHERE expires_at > NOW()`),
    firstCount(prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) AS total FROM student_security_alerts WHERE status = 'open'`),
    firstCount(prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) AS total FROM student_security_alerts WHERE status = 'open' AND severity = 'high'`),
    prisma.$queryRaw<Array<{
      id: bigint
      accountId: bigint
      fullName: string | null
      email: string | null
      deviceIdHint: string | null
      lastUserAgent: string | null
      firstSeenAt: Date | null
      lastSeenAt: Date | null
    }>>`
      SELECT
        d.id,
        d.account_id AS accountId,
        sa.full_name AS fullName,
        sa.email,
        d.device_id_hint AS deviceIdHint,
        d.last_user_agent AS lastUserAgent,
        d.first_seen_at AS firstSeenAt,
        d.last_seen_at AS lastSeenAt
      FROM student_account_devices d
      JOIN student_accounts sa ON sa.id = d.account_id
      WHERE (${query} = '' OR LOWER(sa.full_name) LIKE ${like} OR LOWER(sa.email) LIKE ${like} OR LOWER(COALESCE(d.device_id_hint, '')) LIKE ${like})
      ORDER BY d.last_seen_at DESC, d.id DESC
      LIMIT 160
    `.catch(() => []),
    prisma.$queryRaw<Array<{
      id: bigint
      accountId: bigint
      fullName: string | null
      email: string | null
      alertType: string | null
      severity: string | null
      title: string | null
      status: string | null
      occurrences: number | bigint | null
      detailsJson: string | null
      createdAt: Date | null
      lastSeenAt: Date | null
    }>>`
      SELECT
        a.id,
        a.account_id AS accountId,
        sa.full_name AS fullName,
        sa.email,
        a.alert_type AS alertType,
        a.severity,
        a.title,
        a.status,
        a.occurrences,
        a.details_json AS detailsJson,
        a.created_at AS createdAt,
        a.last_seen_at AS lastSeenAt
      FROM student_security_alerts a
      JOIN student_accounts sa ON sa.id = a.account_id
      WHERE a.status = 'open'
        AND (${query} = '' OR LOWER(sa.full_name) LIKE ${like} OR LOWER(sa.email) LIKE ${like} OR LOWER(a.title) LIKE ${like})
      ORDER BY a.last_seen_at DESC, a.id DESC
      LIMIT 100
    `.catch(() => [])
  ])

  return { trustedDevices, activeSessions, openAlerts, highAlerts, deviceRows, alertRows }
}

export default async function SecurityPage({ searchParams }: PageProps) {
  const params = await searchParams || {}
  const search = param(params, "q", "")
  const data = await getSecurityData(search)

  return (
    <main className="space-y-8 pb-12">
      
      {/* Header & Controls */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">System Integrity</p>
          <h1 className="mt-1 flex items-center gap-3 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Security Operations
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Audit trusted student devices, monitor active session concurrency, and mitigate suspicious access alerts in real-time.
          </p>
        </div>
        
        <form className="flex w-full shrink-0 flex-col gap-3 sm:flex-row lg:w-auto">
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input 
              name="q" 
              defaultValue={search} 
              placeholder="Search profile, email, or device..." 
              className="w-full rounded-xl border border-input bg-card px-4 py-2.5 pl-11 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" 
            />
          </div>
          <button className="btn-primary w-full justify-center shadow-sm sm:w-auto" type="submit">
            Apply Filter
          </button>
        </form>
      </div>

      {/* Primary Pulse Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Trusted Devices", value: data.trustedDevices, icon: Smartphone, color: "text-primary", bg: "bg-primary/10", border: "hover:border-primary/40" },
          { label: "Active Sessions", value: data.activeSessions, icon: Activity, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "hover:border-emerald-500/40" },
          { label: "Open Alerts", value: data.openAlerts, icon: ShieldAlert, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "hover:border-amber-500/40" },
          { label: "High Severity", value: data.highAlerts, icon: AlertTriangle, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10", border: "hover:border-rose-500/40" }
        ].map((stat) => (
          <div key={stat.label} className={`group flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 ${stat.border}`}>
            <div className="flex items-center justify-between gap-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-6 font-heading text-3xl font-black text-foreground">{stat.value}</p>
          </div>
        ))}
      </section>

      {/* Active Incident Queue */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-border bg-muted/20 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-black text-foreground">Incident Queue</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Investigate device limits, new device anomalies, and suspicious activity.</p>
            </div>
          </div>
          <div className="shrink-0 rounded-lg border border-border bg-background px-4 py-2 text-center shadow-inner">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Visible Alerts</p>
            <p className="font-heading text-xl font-black text-foreground">{data.alertRows.length}</p>
          </div>
        </div>

        <div className="max-h-[600px] overflow-auto bg-background p-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 sm:p-8">
          <div className="grid gap-4">
            {data.alertRows.length ? data.alertRows.map((alert) => (
              <article key={String(alert.id)} className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary/20 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm ${severityTone(alert.severity)}`}>
                      {alert.severity || "Medium"} Severity
                    </span>
                    <span className="inline-flex items-center rounded-md bg-muted/50 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {alert.alertType || "Generic Alert"}
                    </span>
                  </div>
                  
                  <h3 className="mt-3 font-heading text-lg font-black text-foreground">
                    {alert.title || "Suspicious Security Event"}
                  </h3>
                  
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{alert.fullName || "Unknown Student"}</span>
                    <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> {alert.email || "No Email"}</span>
                    <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Count: {toInt(alert.occurrences)}</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    Last active occurrence at {formatDate(alert.lastSeenAt)}
                  </p>
                </div>
                
                <form action={resetSecurityStudentDevicesAction} className="shrink-0 pt-2 lg:pt-0">
                  <input type="hidden" name="accountId" value={String(alert.accountId)} />
                  <button 
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-5 py-2.5 text-sm font-bold text-destructive shadow-sm transition-all hover:bg-destructive hover:text-destructive-foreground sm:w-auto" 
                    type="submit"
                  >
                    <RotateCcw className="h-4 w-4" /> Mitigate: Reset Devices
                  </button>
                </form>
              </article>
            )) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-heading text-lg font-bold text-foreground">All Clear</h3>
                <p className="mt-1 text-sm text-muted-foreground">No open security alerts require your attention right now.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Trusted Device Ledger */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-border bg-muted/20 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Laptop className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-black text-foreground">Trusted Device Ledger</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Audit authorized devices actively mapped to student profiles.</p>
            </div>
          </div>
          <div className="shrink-0 rounded-lg border border-border bg-background px-4 py-2 text-center shadow-inner">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Visible Devices</p>
            <p className="font-heading text-xl font-black text-foreground">{data.deviceRows.length}</p>
          </div>
        </div>

        <div className="max-h-[600px] overflow-auto bg-background scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
          <table className="w-full min-w-[74rem] text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-10 border-b border-border bg-card/90 text-[10px] font-bold uppercase tracking-widest text-muted-foreground backdrop-blur-md">
              <tr>
                <th className="px-6 py-4">Learner Profile</th>
                <th className="px-6 py-4">Device Fingerprint</th>
                <th className="px-6 py-4">Identified Client / Browser</th>
                <th className="px-6 py-4">Timeline Activity</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.deviceRows.length ? data.deviceRows.map((device) => (
                <tr key={String(device.id)} className="transition-colors hover:bg-muted/5">
                  <td className="px-6 py-4">
                    <p className="font-heading font-bold text-foreground">{device.fullName || "Unknown Student"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{device.email || "No Email"}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-[10px] font-semibold text-muted-foreground shadow-sm">
                      {device.deviceIdHint || "Unknown Fingerprint"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="max-w-[280px] truncate text-xs font-medium text-muted-foreground" title={device.lastUserAgent || "No user agent"}>
                      {device.lastUserAgent || "Client signature hidden or missing."}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-muted-foreground">
                    <p>First Seen: {formatDate(device.firstSeenAt)}</p>
                    <p className="mt-0.5 text-foreground">Last Seen: {formatDate(device.lastSeenAt)}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <form action={resetSecurityStudentDevicesAction}>
                      <input type="hidden" name="accountId" value={String(device.accountId)} />
                      <button 
                        className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-xs font-bold text-muted-foreground shadow-sm transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive" 
                        type="submit"
                        title="Reset all devices for this student"
                      >
                        Reset Profile Devices
                      </button>
                    </form>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm font-semibold text-muted-foreground">
                    No active trusted devices found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      
    </main>
  )
}
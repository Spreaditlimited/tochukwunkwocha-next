import Link from "next/link"
import { 
  Building2, 
  Calendar,
  CheckCircle2, 
  ClipboardList, 
  CreditCard, 
  PhoneCall, 
  Save, 
  School, 
  ShieldCheck, 
  Users, 
  UsersRound 
} from "lucide-react"

import { prisma } from "@/lib/prisma"
import { PremiumPicker } from "@/components/PremiumPicker"
import { formatMinorCurrency } from "@/lib/student-dashboard"
import { formatDate } from "@/lib/utils"
import { updateSchoolAccountAction } from "./actions"

export const dynamic = "force-dynamic"

type SchoolRow = {
  id: bigint
  schoolName: string | null
  courseSlug: string | null
  status: string | null
  seatsPurchased: number | bigint | null
  pricePerStudentMinor: number | bigint | null
  vatBps: number | bigint | null
  totalMinor: number | bigint | null
  paidAt: Date | null
  accessStartsAt: Date | null
  accessExpiresAt: Date | null
  adminName: string | null
  adminEmail: string | null
  seatsUsed: number | bigint | null
  studentsTotal: number | bigint | null
}

async function listSchools() {
  return prisma.$queryRaw<SchoolRow[]>`
    SELECT
      sc.id,
      sc.school_name AS schoolName,
      sc.course_slug AS courseSlug,
      sc.status,
      sc.seats_purchased AS seatsPurchased,
      sc.price_per_student_minor AS pricePerStudentMinor,
      sc.vat_bps AS vatBps,
      sc.total_minor AS totalMinor,
      sc.paid_at AS paidAt,
      sc.access_starts_at AS accessStartsAt,
      sc.access_expires_at AS accessExpiresAt,
      sa.full_name AS adminName,
      sa.email AS adminEmail,
      (
        SELECT COUNT(*)
        FROM school_students ss
        WHERE ss.school_id = sc.id
          AND ss.status = 'active'
      ) AS seatsUsed,
      (
        SELECT COUNT(*)
        FROM school_students ss
        WHERE ss.school_id = sc.id
      ) AS studentsTotal
    FROM school_accounts sc
    LEFT JOIN school_admins sa ON sa.school_id = sc.id AND sa.is_active = 1
    ORDER BY COALESCE(sc.paid_at, sc.created_at) DESC, sc.id DESC
  `.catch(() => [])
}

function dateInput(value: Date | null) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : ""
}

function statusPill(status: string | null) {
  const raw = String(status || "active").toLowerCase()
  let colorClass = "border-border bg-muted text-muted-foreground"
  
  if (raw === "active") {
    colorClass = "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  } else if (raw === "disabled") {
    colorClass = "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
  } else if (raw === "expired") {
    colorClass = "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
  }

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm ${colorClass}`}>
      {raw}
    </span>
  )
}

export default async function InternalSchoolsPage() {
  const schools = await listSchools()
  const seatsPurchased = schools.reduce((sum, school) => sum + Number(school.seatsPurchased || 0), 0)
  const seatsUsed = schools.reduce((sum, school) => sum + Number(school.seatsUsed || 0), 0)
  const activeSchools = schools.filter((school) => String(school.status || "active").toLowerCase() === "active").length
  const statusOptions = [
    { value: "active", label: "Active" },
    { value: "disabled", label: "Disabled" },
    { value: "expired", label: "Expired" }
  ]

  return (
    <main className="space-y-8 pb-12">
      
      {/* Header & Controls */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">B2B Operations</p>
          <h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            School Management
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Monitor organizational accounts, seat utilization, institutional pricing, and automated access expirations.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Link href="/internal/school-scorecards" className="btn-secondary shadow-sm">
            <ClipboardList className="mr-2 h-4 w-4" /> Scorecards
          </Link>
          <Link href="/internal/school-calls" className="btn-secondary shadow-sm">
            <PhoneCall className="mr-2 h-4 w-4" /> Sales Calls
          </Link>
        </div>
      </div>

      {/* Primary Pulse Metrics */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="group flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active Schools</p>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 transition-transform group-hover:scale-110 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-6 font-heading text-4xl font-black text-foreground">{activeSchools}</p>
        </div>
        
        <div className="group flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Global Seats Used</p>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
              <UsersRound className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-6 font-heading text-4xl font-black text-foreground">
            {seatsUsed} <span className="text-xl font-medium text-muted-foreground">/ {seatsPurchased}</span>
          </p>
        </div>

        <div className="group flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-sky-500/40 hover:shadow-lg hover:shadow-sky-500/5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Accounts</p>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 transition-transform group-hover:scale-110 dark:text-sky-400">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-6 font-heading text-4xl font-black text-foreground">{schools.length}</p>
        </div>
      </section>

      {/* Main Registry */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-border bg-muted/20 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <School className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-black text-foreground">School Registry</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Comprehensive ledger of institutional accounts.</p>
            </div>
          </div>
          <div className="shrink-0 rounded-lg border border-border bg-background px-4 py-2 text-center shadow-inner">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ledger Count</p>
            <p className="font-heading text-xl font-black text-foreground">{schools.length}</p>
          </div>
        </div>

        <div className="max-h-[800px] overflow-auto bg-background scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
          <table className="w-full min-w-[88rem] text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-10 border-b border-border bg-card/90 text-[10px] font-bold uppercase tracking-widest text-muted-foreground backdrop-blur-md">
              <tr>
                <th className="px-6 py-4">Institution Profile</th>
                <th className="px-6 py-4">Admin Contact</th>
                <th className="px-6 py-4">Seat Allocation</th>
                <th className="px-6 py-4">Financials</th>
                <th className="px-6 py-4">Access Lifecycle</th>
                <th className="px-6 py-4 text-right">Account Configuration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {schools.length ? schools.map((school) => {
                const purchased = Number(school.seatsPurchased || 0)
                const used = Number(school.seatsUsed || 0)
                const seatProgress = purchased > 0 ? Math.min(100, Math.round((used / purchased) * 100)) : 0
                
                return (
                  <tr key={String(school.id)} className="align-top transition-colors hover:bg-muted/5">
                    
                    {/* Institution Identity */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 mb-2">
                        {statusPill(school.status)}
                        <span className="inline-flex rounded-md bg-muted/50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {school.courseSlug || "-"}
                        </span>
                      </div>
                      <p className="font-heading text-lg font-black text-foreground">{school.schoolName || "Unnamed School"}</p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <CreditCard className="h-3 w-3" /> Paid: {school.paidAt ? formatDate(school.paidAt) : "Never"}
                      </p>
                    </td>
                    
                    {/* Admin Profile */}
                    <td className="px-6 py-5">
                      <p className="flex items-center gap-1.5 font-bold text-foreground">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        {school.adminName || "No Admin Assigned"}
                      </p>
                      <p className="mt-1 pl-5 text-xs text-muted-foreground">{school.adminEmail || "-"}</p>
                    </td>
                    
                    {/* Seat Utilization */}
                    <td className="px-6 py-5 w-[220px]">
                      <div className="flex items-end justify-between mb-1.5">
                        <p className="flex items-center gap-1.5 font-bold text-foreground">
                          <Users className="h-4 w-4 text-primary" />
                          {used} <span className="text-xs font-medium text-muted-foreground">/ {purchased}</span>
                        </p>
                        <span className="text-[10px] font-bold text-muted-foreground">{seatProgress}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted shadow-inner">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${seatProgress >= 100 ? 'bg-rose-500' : seatProgress >= 80 ? 'bg-amber-500' : 'bg-primary'}`} 
                          style={{ width: `${seatProgress}%` }} 
                        />
                      </div>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Enrolled Students: {Number(school.studentsTotal || 0)}
                      </p>
                    </td>
                    
                    {/* Financial Summary */}
                    <td className="px-6 py-5">
                      <p className="font-heading font-black text-foreground">
                        {formatMinorCurrency("NGN", Number(school.pricePerStudentMinor || 0))} <span className="font-sans text-xs font-medium text-muted-foreground">/ seat</span>
                      </p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        VAT applied: {(Number(school.vatBps || 0) / 100).toFixed(2).replace(/\.00$/, "")}%
                      </p>
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-bold text-primary">
                        Total: {formatMinorCurrency("NGN", Number(school.totalMinor || 0))}
                      </p>
                    </td>
                    
                    {/* Lifecycle */}
                    <td className="px-6 py-5">
                      <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {school.accessExpiresAt ? formatDate(school.accessExpiresAt) : "Never Expires"}
                      </p>
                      <p className="mt-1.5 pl-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Starts: {school.accessStartsAt ? formatDate(school.accessStartsAt) : "Immediate"}
                      </p>
                    </td>
                    
                    {/* Inline Editor */}
                    <td className="px-6 py-5 text-right">
                      <form action={updateSchoolAccountAction} className="ml-auto grid w-[300px] gap-3 rounded-xl border border-border bg-muted/20 p-4 text-left shadow-inner">
                        <input type="hidden" name="schoolId" value={String(school.id)} />
                        
                        <label className="block">
                          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Seats Purchased</span>
                          <input 
                            name="seatsPurchased" 
                            type="number" 
                            min="1" 
                            step="1" 
                            defaultValue={Number(school.seatsPurchased || 1)} 
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-bold outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" 
                          />
                        </label>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Account Status</span>
                            <PremiumPicker name="status" defaultValue={school.status || "active"} options={statusOptions} className="[&>select]:h-10 [&>select]:text-xs" />
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Expiration Date</span>
                            <input 
                              name="accessExpiresAt" 
                              type="date" 
                              defaultValue={dateInput(school.accessExpiresAt)} 
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-bold outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" 
                            />
                          </label>
                        </div>
                        
                        <button className="btn-secondary mt-1 w-full justify-center text-xs shadow-sm" type="submit">
                          <Save className="mr-1.5 h-3.5 w-3.5" /> Save Configuration
                        </button>
                      </form>
                    </td>
                    
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="mx-auto flex flex-col items-center justify-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <Building2 className="h-6 w-6" />
                      </div>
                      <h3 className="font-heading text-lg font-bold text-foreground">No Schools Found</h3>
                      <p className="mt-1 text-sm text-muted-foreground">There are currently no institutional accounts recorded in the system.</p>
                    </div>
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

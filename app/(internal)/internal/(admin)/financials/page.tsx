import Link from "next/link"
import {
  BadgePoundSterling,
  BookOpenCheck,
  CalendarRange,
  Download,
  FileSpreadsheet,
  Landmark,
  Percent,
  ReceiptText,
  Search,
  ShoppingBag
} from "lucide-react"

import { DashboardStatCard, DashboardStatsVisibility } from "@/components/dashboard/DashboardStatsVisibility"
import { PremiumPicker } from "@/components/PremiumPicker"
import {
  formatFinancialMoney,
  listFinancialTransactions,
  parseFinancialFilters,
  type CurrencySummary
} from "@/lib/admin-financials"
import { requireAdmin } from "@/lib/auth"
import { formatDateTimeWAT } from "@/lib/utils"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const fieldClass =
  "mt-2 w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
const labelClass = "block text-[10px] font-bold uppercase tracking-widest text-muted-foreground"

function moneyLines(summary: CurrencySummary[], key: keyof CurrencySummary) {
  if (!summary.length) return "—"
  return (
    <span className="space-y-1">
      {summary.map((item) => (
        <span key={item.currency} className="block whitespace-nowrap">
          {formatFinancialMoney(item.currency, Number(item[key] || 0))}
        </span>
      ))}
    </span>
  )
}

function queryString(filters: ReturnType<typeof parseFinancialFilters>, overrides: Record<string, string | number> = {}) {
  const params = new URLSearchParams()
  const values = { ...filters, ...overrides }
  Object.entries(values).forEach(([key, value]) => {
    if (value !== "" && value !== undefined) params.set(key, String(value))
  })
  return params.toString()
}

function qualityTone(quality: string) {
  return quality === "estimated"
    ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
}

export default async function FinancialsPage({ searchParams }: PageProps) {
  await requireAdmin("/internal/financials")
  const rawParams = (await searchParams) || {}
  const filters = parseFinancialFilters(rawParams)
  const data = await listFinancialTransactions(filters)
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const currencies = [...new Set(data.options.map((item) => item.currency).filter(Boolean))]
  const providers = [...new Set(data.options.map((item) => item.provider).filter(Boolean))]
  const products = [...new Map(
    data.options
      .filter((item) => item.productSlug)
      .map((item) => [item.productSlug, item.productLabel] as const)
  )]

  return (
    <main className="space-y-8 pb-12">
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">Revenue</p>
          <h1 className="mt-1 flex items-center gap-3 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Landmark className="h-5 w-5" />
            </span>
            Business Financials
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Review paid course and shop revenue, separate every currency, and export the filtered records for reporting.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/api/internal/financials/export?format=pdf&${queryString(filters)}`} className="btn-secondary">
            <Download className="h-4 w-4" /> Export PDF
          </Link>
          <Link href={`/api/internal/financials/export?format=xlsx&${queryString(filters)}`} className="btn-primary">
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <form method="get" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
          <label className={labelClass}>Period
            <PremiumPicker
              name="period"
              defaultValue={filters.period}
              className="mt-2"
              options={[
                { value: "today", label: "Today" },
                { value: "this_week", label: "This week" },
                { value: "this_month", label: "This month" },
                { value: "last_month", label: "Last month" },
                { value: "this_quarter", label: "This quarter" },
                { value: "this_year", label: "This year" },
                { value: "custom", label: "Custom dates" },
                { value: "all", label: "All time" }
              ]}
            />
          </label>
          <label className={labelClass}>From
            <input name="from" type="date" defaultValue={filters.from} className={fieldClass} />
          </label>
          <label className={labelClass}>To
            <input name="to" type="date" defaultValue={filters.to} className={fieldClass} />
          </label>
          <label className={labelClass}>Revenue source
            <PremiumPicker
              name="category"
              defaultValue={filters.category}
              className="mt-2"
              options={[
                { value: "", label: "Courses and shop" },
                { value: "course", label: "Courses" },
                { value: "shop", label: "Shop" }
              ]}
            />
          </label>
          <label className={labelClass}>Currency
            <PremiumPicker
              name="currency"
              defaultValue={filters.currency}
              className="mt-2"
              options={[
                { value: "", label: "All currencies" },
                ...currencies.map((currency) => ({ value: currency, label: currency }))
              ]}
            />
          </label>
          <label className={labelClass}>Payment provider
            <PremiumPicker
              name="provider"
              defaultValue={filters.provider}
              className="mt-2"
              options={[
                { value: "", label: "All providers" },
                ...providers.map((provider) => ({ value: provider, label: provider.replace(/_/g, " ") }))
              ]}
            />
          </label>
          <label className={labelClass}>Product or course
            <PremiumPicker
              name="product"
              defaultValue={filters.product}
              className="mt-2"
              options={[
                { value: "", label: "All products" },
                ...products.map(([slug, label]) => ({ value: slug, label }))
              ]}
            />
          </label>
          <label className={labelClass}>Sort
            <PremiumPicker
              name="sort"
              defaultValue={filters.sort}
              className="mt-2"
              options={[
                { value: "newest", label: "Newest first" },
                { value: "oldest", label: "Oldest first" },
                { value: "amount_high", label: "Highest amount" },
                { value: "amount_low", label: "Lowest amount" },
                { value: "product", label: "Product name" }
              ]}
            />
          </label>
          <label className={`${labelClass} md:col-span-2 xl:col-span-3 2xl:col-span-4`}>Search
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 mt-1 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input name="search" defaultValue={filters.search} className={`${fieldClass} pl-10`} placeholder="Customer, email, product or reference" />
            </span>
          </label>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-1 2xl:col-span-2">
            <button type="submit" className="btn-primary h-12 flex-1 justify-center">Apply filters</button>
            <Link href="/internal/financials" className="btn-secondary h-12 justify-center">Reset</Link>
          </div>
        </form>
      </section>

      <DashboardStatsVisibility storageKey="tochukwu-internal-financials-stats">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <DashboardStatCard statKey="Total collected" label="Total collected" value={moneyLines(data.summary, "totalCollectedMinor")} icon={<BadgePoundSterling className="h-5 w-5" />} description="Money successfully received" valueClassName="text-xl" />
          <DashboardStatCard statKey="Course revenue" label="Course revenue" value={moneyLines(data.summary, "courseRevenueMinor")} icon={<BookOpenCheck className="h-5 w-5" />} description="Online, manual and instalments" valueClassName="text-xl" />
          <DashboardStatCard statKey="Shop revenue" label="Shop revenue" value={moneyLines(data.summary, "shopRevenueMinor")} icon={<ShoppingBag className="h-5 w-5" />} description="Paid shop orders" valueClassName="text-xl" />
          <DashboardStatCard statKey="VAT collected" label="VAT collected" value={moneyLines(data.summary, "vatMinor")} icon={<Percent className="h-5 w-5" />} description="Exact and labelled estimates" valueClassName="text-xl" />
          <DashboardStatCard statKey="Processing fees" label="Processing fees" value={moneyLines(data.summary, "processingFeeMinor")} icon={<ReceiptText className="h-5 w-5" />} description="Fees charged at checkout" valueClassName="text-xl" />
          <DashboardStatCard statKey="Transactions" label="Transactions" value={data.total.toLocaleString("en-GB")} icon={<CalendarRange className="h-5 w-5" />} description="Paid transactions in this view" valueClassName="text-xl" />
        </section>
      </DashboardStatsVisibility>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-2 border-b border-border bg-muted/20 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-xl font-black text-foreground">Transaction ledger</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Showing {data.rows.length.toLocaleString("en-GB")} of {data.total.toLocaleString("en-GB")} paid transactions.
            </p>
          </div>
          <span className="text-xs font-bold text-muted-foreground">Page {Math.min(filters.page, totalPages)} of {totalPages}</span>
        </div>

        <div className="max-h-[68vh] overflow-auto overscroll-contain">
          <table className="min-w-[1500px] w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {["Paid", "Source", "Product", "Customer", "Reference", "Provider", "Sales", "Discount", "VAT", "Fee", "Shipping", "Collected", "Breakdown"].map((heading) => (
                  <th key={heading} className="whitespace-nowrap px-4 py-3 font-bold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.rows.map((row) => (
                <tr key={row.transactionUuid} className="align-top transition hover:bg-muted/20">
                  <td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground">{formatDateTimeWAT(row.paidAt)}</td>
                  <td className="px-4 py-4">
                    <span className="font-bold text-foreground">{row.category === "shop" ? "Shop" : "Course"}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{row.paymentType}</span>
                  </td>
                  <td className="max-w-56 px-4 py-4 font-semibold text-foreground">{row.productLabel}</td>
                  <td className="max-w-56 px-4 py-4">
                    <span className="block font-semibold text-foreground">{row.customerName || "—"}</span>
                    <span className="mt-1 block break-all text-xs text-muted-foreground">{row.customerEmail || "—"}</span>
                  </td>
                  <td className="max-w-52 break-all px-4 py-4 font-mono text-xs text-muted-foreground">{row.paymentReference || "—"}</td>
                  <td className="px-4 py-4 capitalize text-muted-foreground">{row.provider.replace(/_/g, " ") || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-semibold">{formatFinancialMoney(row.currency, row.salesAmountMinor)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{formatFinancialMoney(row.currency, row.discountMinor)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{formatFinancialMoney(row.currency, row.vatMinor)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{formatFinancialMoney(row.currency, row.processingFeeMinor)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{formatFinancialMoney(row.currency, row.shippingMinor)}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-black text-foreground">{formatFinancialMoney(row.currency, row.totalCollectedMinor)}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${qualityTone(row.breakdownQuality)}`}>
                      {row.breakdownQuality}
                    </span>
                  </td>
                </tr>
              ))}
              {!data.rows.length ? (
                <tr><td colSpan={13} className="px-6 py-16 text-center text-sm text-muted-foreground">No paid transactions match these filters.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-border p-4">
            {filters.page > 1 ? <Link href={`/internal/financials?${queryString(filters, { page: filters.page - 1 })}`} className="btn-secondary">Previous</Link> : <span />}
            {filters.page < totalPages ? <Link href={`/internal/financials?${queryString(filters, { page: filters.page + 1 })}`} className="btn-secondary">Next</Link> : <span />}
          </div>
        ) : null}
      </section>

      <aside className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm leading-relaxed text-muted-foreground">
        <strong className="text-foreground">About estimated VAT:</strong> older course payments did not save a separate VAT value.
        Their VAT is calculated once using the current VAT setting and marked “Estimated”. New payments and shop orders retain their exact checkout breakdown.
      </aside>
    </main>
  )
}

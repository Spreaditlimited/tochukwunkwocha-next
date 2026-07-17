"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import { CalendarClock, CreditCard, Globe2, Network, RefreshCw, Server } from "lucide-react"

type DnsRecord = { key: string; host: string; type: string; value: string; ttl: number }
type NetlifyDetails = {
  netlifyEmail: string
  netlifyWorkspace: string
  netlifySiteName: string
  accessDetails: string
  updatedAt?: string | Date | null
}

type OwnedDomain = {
  domainName: string
  provider: string
  status: string
  registeredAt: string | Date | null
  renewalDueAt: string | Date | null
  createdAt: string | Date | null
  purchaseCurrency: string | null
  purchaseAmountMinor: number | null
  selectedServices: string[]
  autoRenewEnabled: boolean
}

const dnsTypes = ["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "CAA", "NS"]

function formatDate(value: string | Date | null) {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "-"
}

function formatMoney(currency: string | null, amountMinor: number | null) {
  if (!currency || !amountMinor) return "-"
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amountMinor / 100)
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`
  }
}

async function jsonRequest<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, options)
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.ok) throw new Error(json?.error || "Request failed")
  return json as T
}

function blankRecord(index = Date.now()): DnsRecord {
  return { key: `dns_${index}`, host: "@", type: "A", value: "", ttl: 3600 }
}

export function OwnedDomainCard({ domain }: { domain: OwnedDomain }) {
  const [panelMode, setPanelMode] = useState<"dns" | "netlify" | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const [nameservers, setNameservers] = useState(["", "", "", ""])
  const [records, setRecords] = useState<DnsRecord[]>([blankRecord(0)])
  const [netlify, setNetlify] = useState<NetlifyDetails>({ netlifyEmail: "", netlifyWorkspace: "", netlifySiteName: "", accessDetails: "" })
  const [dnsStatus, setDnsStatus] = useState("Open this panel to load DNS details.")
  const [dnsError, setDnsError] = useState(false)
  const [netlifyStatus, setNetlifyStatus] = useState("")
  const [netlifyError, setNetlifyError] = useState(false)

  async function loadPanel() {
    if (loaded || loading) return
    setLoading(true)
    setDnsStatus("Loading DNS records...")
    setDnsError(false)
    setNetlifyStatus("Loading Netlify details...")
    setNetlifyError(false)
    const domainParam = encodeURIComponent(domain.domainName)
    const [dnsResult, netlifyResult] = await Promise.allSettled([
      jsonRequest<{ nameservers: string[]; records: Array<Partial<DnsRecord>> }>(`/api/student/domains/dns?domainName=${domainParam}`),
      jsonRequest<{ details: NetlifyDetails | null }>(`/api/student/domains/netlify?domainName=${domainParam}`)
    ])
    if (dnsResult.status === "fulfilled") {
      const nextNameservers = [...(dnsResult.value.nameservers || []).slice(0, 4)]
      while (nextNameservers.length < 4) nextNameservers.push("")
      setNameservers(nextNameservers)
      const nextRecords = (dnsResult.value.records || []).map((record, index) => ({
        key: `dns_${index}`,
        host: String(record.host || ""),
        type: String(record.type || "A").toUpperCase(),
        value: String(record.value || ""),
        ttl: Number(record.ttl || 3600)
      }))
      setRecords(nextRecords.length ? nextRecords : [blankRecord(0)])
      setDnsStatus("DNS loaded. You can now edit and save.")
    } else {
      setDnsError(true)
      setDnsStatus(dnsResult.reason instanceof Error ? dnsResult.reason.message : "Could not load DNS records.")
    }
    if (netlifyResult.status === "fulfilled") {
      if (netlifyResult.value.details) setNetlify(netlifyResult.value.details)
      setNetlifyStatus(netlifyResult.value.details?.updatedAt ? `Last submitted: ${new Date(netlifyResult.value.details.updatedAt).toLocaleString()}` : "No Netlify details submitted yet.")
    } else {
      setNetlifyError(true)
      setNetlifyStatus(netlifyResult.reason instanceof Error ? netlifyResult.reason.message : "Could not load Netlify details.")
    }
    setLoaded(true)
    setLoading(false)
  }

  function togglePanel(mode: "dns" | "netlify") {
    setPanelMode((current) => current === mode ? null : mode)
    if (!loaded) void loadPanel()
  }

  async function renew() {
    setRenewing(true)
    try {
      const result = await jsonRequest<{ checkoutUrl: string }>("/api/student/domains/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ domainName: domain.domainName, years: 1 })
      })
      if (!result.checkoutUrl) throw new Error("Missing renewal payment URL.")
      window.location.assign(result.checkoutUrl)
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : "Could not start renewal payment.")
      setRenewing(false)
    }
  }

  async function saveNameservers() {
    setDnsError(false)
    setDnsStatus("Saving nameservers...")
    try {
      const result = await jsonRequest<{ nameservers?: string[] }>("/api/student/domains/nameservers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ domainName: domain.domainName, nameservers: nameservers.filter(Boolean) })
      })
      if (result.nameservers) {
        const next = [...result.nameservers.slice(0, 4)]
        while (next.length < 4) next.push("")
        setNameservers(next)
      }
      setDnsStatus("Nameservers updated successfully.")
    } catch (reason) {
      setDnsError(true)
      setDnsStatus(reason instanceof Error ? reason.message : "Could not save nameservers.")
    }
  }

  async function saveRecords() {
    const complete = records.filter((record) => record.host && record.type && record.value)
    if (!complete.length) { setDnsError(true); setDnsStatus("Add at least one complete DNS record."); return }
    setDnsError(false)
    setDnsStatus("Saving DNS records...")
    try {
      await jsonRequest("/api/student/domains/dns", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ domainName: domain.domainName, records: complete.map(({ host, type, value, ttl }) => ({ host, type, value, ttl })) })
      })
      setDnsStatus("DNS records updated successfully.")
    } catch (reason) {
      setDnsError(true)
      setDnsStatus(reason instanceof Error ? reason.message : "Could not save DNS records.")
    }
  }

  async function saveNetlify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNetlifyError(false)
    setNetlifyStatus("Submitting Netlify details...")
    try {
      await jsonRequest("/api/student/domains/netlify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ domainName: domain.domainName, ...netlify })
      })
      setNetlifyStatus("Netlify details submitted successfully.")
    } catch (reason) {
      setNetlifyError(true)
      setNetlifyStatus(reason instanceof Error ? reason.message : "Could not submit Netlify details.")
    }
  }

  function updateRecord(key: string, field: keyof Omit<DnsRecord, "key">, value: string | number) {
    setRecords((current) => current.map((record) => record.key === key ? { ...record, [field]: value } : record))
  }

  return (
    <article className="surface-raised overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-col gap-4 border-b border-border bg-muted/20 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Globe2 className="h-5 w-5" /></div>
          <div className="min-w-0"><p className="truncate font-heading text-lg font-bold text-foreground">{domain.domainName}</p><p className="mt-1 text-xs text-muted-foreground">Managed through {domain.provider || "your registrar"}</p></div>
        </div>
        <span className="inline-flex w-fit shrink-0 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">{domain.status || "Unknown"}</span>
      </header>

      <div className="p-6 sm:p-8">
      <div className="grid grid-cols-1 gap-3 text-xs text-muted-foreground sm:grid-cols-3">
        <Info icon={<Globe2 className="h-4 w-4" />} label="Registered" value={formatDate(domain.registeredAt || domain.createdAt)} />
        <Info icon={<CalendarClock className="h-4 w-4" />} label="Renewal due" value={formatDate(domain.renewalDueAt)} />
        <Info icon={<CreditCard className="h-4 w-4" />} label="Amount paid" value={formatMoney(domain.purchaseCurrency, domain.purchaseAmountMinor)} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 text-xs text-muted-foreground sm:grid-cols-2">
        <Info icon={<Server className="h-4 w-4" />} label="Add-ons" value={domain.selectedServices.length ? domain.selectedServices.join(", ") : "None"} />
        <Info icon={<RefreshCw className="h-4 w-4" />} label="Auto-renew" value={domain.autoRenewEnabled ? "On" : "Off"} />
      </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border bg-muted/10 px-6 py-5 sm:px-8">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void renew()} disabled={renewing} className="btn-secondary justify-center text-xs"><RefreshCw className={`mr-2 h-4 w-4 ${renewing ? "animate-spin" : ""}`} />{renewing ? "Preparing renewal..." : "Renew (1 year)"}</button>
        <button type="button" onClick={() => togglePanel("dns")} className="btn-secondary justify-center text-xs"><Network className="mr-2 h-4 w-4" />Manage DNS</button>
        <button type="button" onClick={() => togglePanel("netlify")} className="btn-primary justify-center text-xs"><Server className="mr-2 h-4 w-4" />Netlify Details</button>
      </div>
      <p className="text-xs text-muted-foreground">Prompt to Profit students: use <span className="font-semibold text-foreground">Netlify Details</span> to submit your connection information.</p>
      </div>

      {panelMode ? (
        <div className="border-t border-border bg-background p-6 sm:p-8">
          {panelMode === "dns" ? (
            <>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><Network className="h-4 w-4 text-primary" /><h5 className="text-sm font-bold text-foreground">DNS Management</h5></div><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Propagation may take up to 24h</span></div>
              <p className={`mb-3 text-xs ${dnsError ? "text-destructive" : "text-muted-foreground"}`}>{loading ? "Loading DNS records..." : dnsStatus}</p>
              <section className="rounded-xl border border-border bg-background p-3 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nameservers</p>
                <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2">{nameservers.map((value, index) => <input key={index} value={value} onChange={(event) => setNameservers((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" placeholder={`ns${index + 1}.example.com${index > 1 ? " (optional)" : ""}`} />)}</div>
                <div className="mt-3 flex justify-end"><button type="button" onClick={() => void saveNameservers()} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Save Nameservers</button></div>
              </section>
              <section className="mt-4 rounded-xl border border-border bg-background p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">DNS Records</p><button type="button" onClick={() => setRecords((current) => [...current, blankRecord()])} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground">Add record</button></div>
                <div className="space-y-2">{records.map((record) => <div key={record.key} className="grid min-w-0 grid-cols-1 gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-12"><input value={record.host} onChange={(event) => updateRecord(record.key, "host", event.target.value)} className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm lg:col-span-2" placeholder="Host" /><select value={record.type} onChange={(event) => updateRecord(record.key, "type", event.target.value)} className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm lg:col-span-2">{dnsTypes.map((type) => <option key={type}>{type}</option>)}</select><input value={record.value} onChange={(event) => updateRecord(record.key, "value", event.target.value)} className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm lg:col-span-5" placeholder="Value" /><input type="number" min={60} max={86400} value={record.ttl} onChange={(event) => updateRecord(record.key, "ttl", Number(event.target.value || 3600))} className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm lg:col-span-2" placeholder="TTL" /><button type="button" onClick={() => setRecords((current) => current.filter((item) => item.key !== record.key))} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold lg:col-span-1">Remove</button></div>)}</div>
                <div className="mt-3 flex justify-end"><button type="button" onClick={() => void saveRecords()} className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Save DNS Records</button></div>
              </section>
            </>
          ) : null}

          <form onSubmit={saveNetlify} className={`${panelMode === "dns" ? "mt-4" : ""} rounded-xl border border-border bg-background p-3 sm:p-4`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Netlify Connection Details (Prompt to Profit)</p>
            <p className="mt-1 text-xs text-muted-foreground">Submit the 4 details we need to connect your domain to your Netlify project.</p>
            <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2"><input type="email" value={netlify.netlifyEmail} onChange={(event) => setNetlify((current) => ({ ...current, netlifyEmail: event.target.value }))} className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="Login email" required /><input type="password" value={netlify.accessDetails} onChange={(event) => setNetlify((current) => ({ ...current, accessDetails: event.target.value }))} className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="Password (temporary)" required /><input value={netlify.netlifySiteName} onChange={(event) => setNetlify((current) => ({ ...current, netlifySiteName: event.target.value }))} className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="Project name" required /><input value={netlify.netlifyWorkspace} onChange={(event) => setNetlify((current) => ({ ...current, netlifyWorkspace: event.target.value }))} className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="Temporary Netlify domain (e.g. mysite.netlify.app)" required /></div>
            <p className="mt-2 text-[11px] text-amber-600">Important: Change this password once your domain connection is complete.</p>
            <div className="mt-3 flex justify-end"><button className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Submit Netlify Details</button></div>
            <p className={`mt-2 text-xs ${netlifyError ? "text-destructive" : "text-muted-foreground"}`}>{netlifyStatus}</p>
          </form>
        </div>
      ) : null}
    </article>
  )
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex min-w-0 items-start gap-3 rounded-lg border border-border bg-background p-4"><span className="mt-0.5 shrink-0 text-primary">{icon}</span><span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span><span className="mt-1 block break-words font-semibold text-foreground">{value}</span></span></div>
}

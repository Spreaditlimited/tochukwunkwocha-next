"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { 
  AlertTriangle, 
  CheckCircle2, 
  Globe, 
  Loader2, 
  Network, 
  RefreshCw, 
  Search, 
  Server, 
  Settings 
} from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"

type DomainOption = {
  domainName: string
  status: string
}

async function postJson<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Request failed")
  return payload as T
}

export function DomainActionsPanel({ domains }: { domains: DomainOption[] }) {
  const router = useRouter()
  const [domainName, setDomainName] = useState("")
  const [ownedDomain, setOwnedDomain] = useState(domains[0]?.domainName || "")
  
  // Feedback state
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  
  // Track exactly which action is loading for targeted button spinners
  const [activeAction, setActiveAction] = useState<string | null>(null)

  async function run(actionName: string, action: () => Promise<string>) {
    setActiveAction(actionName)
    setMessage("")
    setError("")
    try {
      const successMessage = await action()
      setMessage(successMessage)
      showStudentToast({ type: "success", title: "Domain action completed", message: successMessage })
      router.refresh()
    } catch (requestError) {
      const errorMessage = requestError instanceof Error ? requestError.message : "Request failed"
      setError(errorMessage)
      showStudentToast({ type: "error", title: "Domain action failed", message: errorMessage })
    } finally {
      setActiveAction(null)
    }
  }

  async function checkDomain() {
    await run("check", async () => {
      const result = await postJson<{ available: boolean; domainName: string; reason: string }>("/api/student/domains/check", { domainName })
      return result.available ? `${result.domainName} is not in your existing records.` : `${result.domainName} already exists in existing records.`
    })
  }

  async function registerDomain() {
    await run("register", async () => {
      const result = await postJson<{ orderUuid: string; domainName: string }>("/api/student/domains/register", { domainName, years: 1, autoRenewEnabled: true })
      return `Registration request created for ${result.domainName}. Reference: ${result.orderUuid}.`
    })
  }

  async function renewDomain() {
    if (!ownedDomain) return
    await run("renew", async () => {
      const result = await postJson<{ domainName: string }>("/api/student/domains/renew", { domainName: ownedDomain, years: 1 })
      return `Renewal request submitted for ${result.domainName}.`
    })
  }

  async function submitDns(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await run("dns", async () => {
      const result = await postJson<{ domainName: string }>("/api/student/domains/dns", {
        domainName: ownedDomain,
        records: [{
          type: String(form.get("type") || "A"),
          host: String(form.get("host") || "@"),
          value: String(form.get("value") || ""),
          ttl: Number(form.get("ttl") || 3600)
        }]
      })
      event.currentTarget.reset()
      return `DNS update request submitted for ${result.domainName}.`
    })
  }

  async function submitNameservers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await run("nameservers", async () => {
      const result = await postJson<{ domainName: string }>("/api/student/domains/nameservers", {
        domainName: ownedDomain,
        nameservers: [form.get("ns1"), form.get("ns2"), form.get("ns3"), form.get("ns4")].map((item) => String(item || "")).filter(Boolean)
      })
      event.currentTarget.reset()
      return `Nameserver update request submitted for ${result.domainName}.`
    })
  }

  async function submitNetlify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await run("netlify", async () => {
      const result = await postJson<{ domainName: string }>("/api/student/domains/netlify", {
        domainName: ownedDomain,
        netlifyEmail: String(form.get("netlifyEmail") || ""),
        netlifyWorkspace: String(form.get("netlifyWorkspace") || ""),
        netlifySiteName: String(form.get("netlifySiteName") || ""),
        accessDetails: String(form.get("accessDetails") || "")
      })
      event.currentTarget.reset()
      return `Netlify access details saved for ${result.domainName}.`
    })
  }

  const isLoading = activeAction !== null

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      
      {/* Header & Global Selector */}
      <div className="flex flex-col gap-6 border-b border-border bg-muted/20 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="eyebrow text-primary">Domain Operations</p>
          <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Management Console</h2>
          <p className="mt-2 text-sm text-muted-foreground">Search, register, renew, and update technical records.</p>
        </div>
        
        {domains.length > 0 && (
          <div className="w-full lg:w-72 shrink-0">
            <label htmlFor="domain-select" className="sr-only">Select Target Domain</label>
            <PremiumPicker
              id="domain-select"
              value={ownedDomain}
              onChange={(event) => setOwnedDomain(event.target.value)}
              options={domains.map((domain) => ({ value: domain.domainName, label: domain.domainName }))}
            />
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Target Domain</p>
          </div>
        )}
      </div>

      <div className="p-6 sm:p-8">
        
        {/* Global Feedback Messages */}
        {message && (
          <div className="mb-8 flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="font-semibold leading-relaxed">{message}</p>
          </div>
        )}
        {error && (
          <div className="mb-8 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="font-semibold leading-relaxed">{error}</p>
          </div>
        )}

        {/* Action Grid */}
        <div className="grid gap-6 xl:grid-cols-2">
          
          {/* Search / Register */}
          <div className="flex flex-col justify-between rounded-xl border border-border bg-background p-5 transition-colors hover:border-primary/20">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <Search className="h-4 w-4 text-primary" /> Search & Register
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Check availability or register a new domain name.</p>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input 
                className="w-full flex-1 rounded-md border border-input bg-background/50 px-4 py-2 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" 
                value={domainName} 
                onChange={(event) => setDomainName(event.target.value)} 
                placeholder="e.g. yourbrand.com" 
              />
              <div className="flex gap-2">
                <button 
                  className="btn-secondary flex-1 px-4 py-2 text-xs sm:flex-none" 
                  type="button" 
                  onClick={checkDomain} 
                  disabled={isLoading || !domainName.trim()}
                >
                  {activeAction === "check" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
                </button>
                <button 
                  className="btn-primary flex-1 px-4 py-2 text-xs sm:flex-none shadow-sm" 
                  type="button" 
                  onClick={registerDomain} 
                  disabled={isLoading || !domainName.trim()}
                >
                  {activeAction === "register" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Register"}
                </button>
              </div>
            </div>
          </div>

          {/* Renewal */}
          <div className="flex flex-col justify-between rounded-xl border border-border bg-background p-5 transition-colors hover:border-primary/20">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <RefreshCw className="h-4 w-4 text-primary" /> Manual Renewal
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Submit a manual renewal request for the selected domain.</p>
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <button 
                className="btn-primary w-full sm:w-auto px-6 py-2.5 text-sm shadow-sm" 
                type="button" 
                onClick={renewDomain} 
                disabled={isLoading || !ownedDomain}
              >
                {activeAction === "renew" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                  "Submit Renewal Request"
                )}
              </button>
            </div>
          </div>

          {/* DNS Record */}
          <form onSubmit={submitDns} className="rounded-xl border border-border bg-background p-5 transition-colors hover:border-primary/20">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Network className="h-4 w-4 text-primary" /> Update DNS Record
            </p>
            <p className="mt-2 text-sm text-muted-foreground mb-5">Add or update a single DNS record.</p>
            
            <div className="grid gap-4 sm:grid-cols-4">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">Type</span>
                <input className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" name="type" placeholder="A" defaultValue="A" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">Host</span>
                <input className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" name="host" placeholder="@" defaultValue="@" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">Value</span>
                <input className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" name="value" placeholder="192.0.2.1" required />
              </label>
              <label className="block sm:col-span-4">
                <span className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">TTL (Seconds)</span>
                <input className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" name="ttl" placeholder="3600" defaultValue="3600" />
              </label>
            </div>
            
            <div className="mt-5 border-t border-border pt-4">
              <button 
                className="btn-secondary w-full sm:w-auto px-6 py-2.5 text-sm" 
                disabled={isLoading || !ownedDomain}
              >
                {activeAction === "dns" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                ) : (
                  "Update DNS Record"
                )}
              </button>
            </div>
          </form>

          {/* Nameservers */}
          <form onSubmit={submitNameservers} className="rounded-xl border border-border bg-background p-5 transition-colors hover:border-primary/20">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Settings className="h-4 w-4 text-primary" /> Update Nameservers
            </p>
            <p className="mt-2 text-sm text-muted-foreground mb-5">Point your domain to custom nameservers.</p>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">Nameserver 1</span>
                <input className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" name="ns1" placeholder="ns1.example.com" required />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">Nameserver 2</span>
                <input className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" name="ns2" placeholder="ns2.example.com" required />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">Nameserver 3 (Optional)</span>
                <input className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" name="ns3" placeholder="ns3.example.com" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">Nameserver 4 (Optional)</span>
                <input className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" name="ns4" placeholder="ns4.example.com" />
              </label>
            </div>
            
            <div className="mt-5 border-t border-border pt-4">
              <button 
                className="btn-secondary w-full sm:w-auto px-6 py-2.5 text-sm" 
                disabled={isLoading || !ownedDomain}
              >
                {activeAction === "nameservers" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                ) : (
                  "Update Nameservers"
                )}
              </button>
            </div>
          </form>

          {/* Netlify Connection */}
          <form onSubmit={submitNetlify} className="rounded-xl border border-border bg-background p-5 transition-colors hover:border-primary/20 xl:col-span-2">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Server className="h-4 w-4 text-primary" /> Netlify Connection Request
            </p>
            <p className="mt-2 text-sm text-muted-foreground mb-5">Provide Netlify project details to map your domain automatically.</p>
            
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">Netlify Login Email</span>
                <input className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" name="netlifyEmail" placeholder="you@example.com" required />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">Project Name</span>
                <input className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" name="netlifySiteName" placeholder="e.g. My Portfolio" required />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">Temporary Netlify Domain</span>
                <input className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary" name="netlifyWorkspace" placeholder="e.g. curious-pika-xyz.netlify.app" required />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase text-muted-foreground">Access Details / Notes</span>
                <input className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" name="accessDetails" placeholder="Temporary password if applicable" required />
              </label>
            </div>
            
            <div className="mt-6 border-t border-border pt-5 flex justify-end">
              <button 
                className="btn-primary w-full sm:w-auto px-8 py-2.5 text-sm shadow-sm" 
                disabled={isLoading || !ownedDomain}
              >
                {activeAction === "netlify" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Details...</>
                ) : (
                  "Save Netlify Connection"
                )}
              </button>
            </div>
          </form>

        </div>
      </div>
    </section>
  )
}

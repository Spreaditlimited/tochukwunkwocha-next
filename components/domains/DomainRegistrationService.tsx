"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Globe2, Loader2, Search, ShieldCheck, Sparkles } from "lucide-react"

import { PremiumPicker } from "@/components/PremiumPicker"
import { getRecaptchaToken } from "@/lib/browser-recaptcha"

type Suggestion = { domainName?: string; available: boolean }
type Quote = {
  currency: string
  provider: "paystack" | "stripe"
  years: number
  nairaSubtotalMinor: number
  exchangeRateNgnPerUnit: number | null
  fxBufferPercent: number
  baseAmountMinor: number
  subtotalMinor: number
  vatPercent: number
  vatAmountMinor: number
  processingFeeMinor: number
  totalAmountMinor: number
}

const countries = [
  ["NG", "Nigeria", "234"], ["GH", "Ghana", "233"], ["KE", "Kenya", "254"], ["ZA", "South Africa", "27"],
  ["EG", "Egypt", "20"], ["MA", "Morocco", "212"], ["ET", "Ethiopia", "251"], ["UG", "Uganda", "256"],
  ["TZ", "Tanzania", "255"], ["RW", "Rwanda", "250"], ["CM", "Cameroon", "237"], ["SN", "Senegal", "221"],
  ["CI", "Cote d'Ivoire", "225"], ["US", "United States", "1"], ["CA", "Canada", "1"], ["GB", "United Kingdom", "44"],
  ["IE", "Ireland", "353"], ["DE", "Germany", "49"], ["FR", "France", "33"], ["NL", "Netherlands", "31"],
  ["BE", "Belgium", "32"], ["ES", "Spain", "34"], ["IT", "Italy", "39"], ["PT", "Portugal", "351"],
  ["CH", "Switzerland", "41"], ["SE", "Sweden", "46"], ["NO", "Norway", "47"], ["DK", "Denmark", "45"],
  ["FI", "Finland", "358"], ["PL", "Poland", "48"], ["AT", "Austria", "43"], ["CZ", "Czech Republic", "420"],
  ["RO", "Romania", "40"], ["GR", "Greece", "30"], ["TR", "Turkey", "90"], ["AE", "United Arab Emirates", "971"],
  ["SA", "Saudi Arabia", "966"], ["QA", "Qatar", "974"], ["KW", "Kuwait", "965"], ["OM", "Oman", "968"],
  ["IN", "India", "91"], ["PK", "Pakistan", "92"], ["BD", "Bangladesh", "880"], ["LK", "Sri Lanka", "94"],
  ["NP", "Nepal", "977"], ["CN", "China", "86"], ["JP", "Japan", "81"], ["KR", "South Korea", "82"],
  ["SG", "Singapore", "65"], ["MY", "Malaysia", "60"], ["ID", "Indonesia", "62"], ["TH", "Thailand", "66"],
  ["PH", "Philippines", "63"], ["VN", "Vietnam", "84"], ["AU", "Australia", "61"], ["NZ", "New Zealand", "64"],
  ["BR", "Brazil", "55"], ["MX", "Mexico", "52"], ["AR", "Argentina", "54"], ["CL", "Chile", "56"],
  ["CO", "Colombia", "57"], ["PE", "Peru", "51"]
] as const

function money(currency: string, minor: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, minimumFractionDigits: 2 }).format(minor / 100)
}

async function api<T>(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.ok) throw new Error(json?.error || "Request failed")
  return json as T
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0]
}

export function DomainRegistrationService({
  account,
  embedded = false
}: {
  account: { fullName: string; email: string; autoRenew: boolean } | null
  embedded?: boolean
}) {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(() => {
    const domain = searchParams.get("domain") || ""
    return searchParams.has("renewal") || domain === "payment_confirmed" ? "" : normalize(domain)
  })
  const [selected, setSelected] = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [quote, setQuote] = useState<Quote | null>(null)
  const [years, setYears] = useState("1")
  const [country, setCountry] = useState("NG")
  const [phoneCc, setPhoneCc] = useState("234")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")

  const countryOptions = useMemo(() => countries
    .map(([value, label]) => ({ value, label: `${label} (${value})` }))
    .sort((left, right) => left.label.localeCompare(right.label)), [])
  const phoneCodeOptions = useMemo(() => {
    const byCode = new Map<string, string[]>()
    countries.forEach(([countryCode, , phoneCode]) => byCode.set(phoneCode, [...(byCode.get(phoneCode) || []), countryCode]))
    return [...byCode.entries()]
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([value, countryCodes]) => ({ value, label: `+${value} (${countryCodes.join(", ")})` }))
  }, [])
  const yearOptions = useMemo(() => Array.from({ length: 10 }, (_, index) => ({ value: String(index + 1), label: `${index + 1} year${index ? "s" : ""}` })), [])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setError("")
    api<{ quote: Quote }>("/api/domains/quote", { domainName: selected, years: Number(years), country, selectedServices: [] })
      .then((result) => { if (!cancelled) setQuote(result.quote) })
      .catch((reason) => { if (!cancelled) { setQuote(null); setError(reason instanceof Error ? reason.message : "Could not load pricing.") } })
    return () => { cancelled = true }
  }, [country, selected, years])

  useEffect(() => {
    const payment = searchParams.get("payment")
    if (payment === "failed" || payment === "cancelled") {
      setError(searchParams.get("reason") || "Payment was not completed. Please try again.")
    }
  }, [searchParams])

  function choose(domainName: string) {
    const value = normalize(domainName)
    setSelected(value)
    setQuery(value)
    setMessage(`${value} is available. Continue below to complete payment details.`)
    setError("")
  }

  async function search(suggest: boolean) {
    const value = normalize(query)
    if (!value) { setError(suggest ? "Enter a preferred domain first." : "Enter a domain first."); return }
    setBusy(suggest ? "suggest" : "search")
    setError("")
    setMessage("")
    setSelected("")
    setQuote(null)
    try {
      if (!suggest && value.includes(".")) {
        const result = await api<{ available: boolean; domainName: string }>("/api/domains/check", { domainName: value })
        if (!result.available) throw new Error(`${value} is not available. Try another name.`)
        choose(result.domainName || value)
        setSuggestions([])
      } else {
        const result = await api<{ suggestions: Suggestion[]; firstAvailable?: string }>("/api/domains/suggest", { preferredName: value })
        const all = result.suggestions.filter((item) => item.domainName)
        const available = all.filter((item) => item.available)
        if (!available.length) throw new Error(value.includes(".") ? "We couldn't find an available option for that name. Try a slightly different name." : "We couldn't find available extensions for that name. Try a slightly different name.")
        if (suggest && value.includes(".")) {
          choose(result.firstAvailable || available[0]?.domainName || "")
          setSuggestions(all)
        } else {
          setSuggestions(available)
          setMessage("Select your preferred extension below to continue.")
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Domain lookup failed.")
    } finally {
      setBusy("")
      if (embedded) window.requestAnimationFrame(() => document.getElementById("domainSuggestions")?.scrollIntoView({ behavior: "smooth", block: "start" }))
    }
  }

  async function checkout(form: FormData) {
    if (!selected) { setError("Search and choose an available domain first."); return }
    setBusy("checkout")
    setError("")
    try {
      const availability = await api<{ available: boolean }>("/api/domains/check", { domainName: selected })
      if (!availability.available) throw new Error(`${selected} is no longer available. Search for another domain.`)
      const recaptchaToken = await getRecaptchaToken("domain_create_payment")
      const result = await api<{ checkoutUrl: string }>("/api/domains/checkout", {
        domainName: selected,
        years: Number(years),
        fullName: form.get("fullName"), email: form.get("email"), recaptchaToken,
        registrantAddress1: form.get("address1"), registrantCity: form.get("city"), registrantState: form.get("state"),
        registrantCountry: country, registrantPostalCode: form.get("postalCode"), registrantPhone: form.get("phone"),
        registrantPhoneCc: phoneCc, autoRenewEnabled: form.get("autoRenew") === "on", selectedServices: []
      })
      window.location.assign(result.checkoutUrl)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not initialize payment.")
      setBusy("")
    }
  }

  if (embedded) {
    return (
      <section id="domainRegisterSection" className="surface-raised scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-4 border-b border-border bg-muted/20 p-6 sm:p-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Search className="h-5 w-5" /></div>
          <div>
            <p className="eyebrow text-primary">Register a domain</p>
            <h2 className="mt-1 font-heading text-2xl font-bold text-foreground">Find your domain right here.</h2>
            <p className="mt-1 text-sm text-muted-foreground">Search live availability and complete registration without leaving your dashboard.</p>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-stretch">
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-input bg-background px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
              <Globe2 className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="sr-only">Domain name</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(false) } }}
                className="min-w-0 w-full border-0 bg-transparent py-3.5 font-mono text-sm text-foreground outline-none"
                placeholder="Type domain (e.g., yourbrand.com)"
              />
            </label>
            <div className="grid min-w-0 grid-cols-2 gap-3 lg:flex lg:flex-none">
              <button type="button" onClick={() => void search(true)} disabled={Boolean(busy)} className="btn-secondary min-w-0 justify-center px-4">
                <Sparkles className="mr-2 h-4 w-4" />{busy === "suggest" ? "Suggesting..." : "AI Suggest"}
              </button>
              <button type="button" onClick={() => void search(false)} disabled={Boolean(busy)} className="btn-primary min-w-0 justify-center px-5">
                <Search className="mr-2 h-4 w-4" />{busy === "search" ? "Searching..." : "Search"}
              </button>
            </div>
          </div>
          <p className="mt-3 text-[11px] font-medium text-muted-foreground">Supported extensions: .com, .net, .org, .io and .co</p>
          <p id="domainStatus" className={`mt-5 min-h-5 text-sm font-medium ${error && !selected ? "text-destructive" : "text-primary"}`}>{error && !selected ? error : message}</p>

          <div id="domainSuggestions" className="mt-6 grid scroll-mt-24 grid-cols-1 gap-3 empty:hidden sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((item) => {
              const domainName = item.domainName || ""
              const stem = normalize(query)
              const extension = !stem.includes(".") && domainName.startsWith(`${stem}.`) ? domainName.slice(stem.length + 1) : ""
              return <button key={domainName} type="button" disabled={!item.available} onClick={() => choose(domainName)} className={`group flex min-w-0 items-center justify-between gap-3 rounded-xl border p-4 text-left text-xs font-semibold transition-all ${item.available ? "border-border bg-background text-foreground hover:border-primary/40 hover:shadow-sm" : "cursor-not-allowed border-border bg-muted/30 text-muted-foreground"}`}><span className="min-w-0">{extension ? <><span className="block text-sm font-bold text-primary">.{extension}</span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{domainName}</span></> : <>{domainName}</>}</span><span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />Available</span></button>
            })}
          </div>

          {selected ? (
          <form id="domainCheckoutCard" action={checkout} className="mt-8 scroll-mt-24 overflow-hidden rounded-xl border border-border bg-background">
            <div className="p-6 sm:p-8">
            <div className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="eyebrow text-primary">Registrant details</p><h3 className="mt-1 font-heading text-xl font-bold text-foreground">Complete registration</h3></div>
              <div className="flex min-w-0 items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" /><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Selected domain</p><p className="mt-0.5 truncate text-sm font-bold text-foreground">{selected}</p></div></div>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2">
                <DashboardField name="fullName" label="Full name" defaultValue={account?.fullName || ""} />
                <DashboardField name="email" label="Email address" type="email" defaultValue={account?.email || ""} />
                <DashboardField name="address1" label="Address" placeholder="Street address" />
                <DashboardField name="city" label="City" />
                <DashboardField name="state" label="State / Province" />
                <label className="block min-w-0"><span className="label text-foreground">Country</span><PremiumPicker className="mt-2 min-w-0" name="country" value={country} options={countryOptions} onChange={(event) => { const value = event.target.value; setCountry(value); setPhoneCc(countries.find(([code]) => code === value)?.[2] || "") }} required /></label>
                <DashboardField name="postalCode" label="Postal code" />
                <DashboardField name="phone" label="Phone number" />
                <label className="block min-w-0"><span className="label text-foreground">Phone country code</span><PremiumPicker className="mt-2 min-w-0" name="phoneCc" value={phoneCc} options={phoneCodeOptions} onChange={(event) => setPhoneCc(event.target.value)} required /></label>
                <label className="block min-w-0"><span className="label text-foreground">Registration period</span><PremiumPicker className="mt-2 min-w-0" name="years" value={years} options={yearOptions} onChange={(event) => setYears(event.target.value)} /></label>
              <label className="flex min-w-0 items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4 md:col-span-2"><span className="min-w-0"><strong className="block text-foreground">Auto-renew this domain</strong><small className="mt-1 block text-muted-foreground">Uses your account preference by default. You can change per checkout.</small></span><input name="autoRenew" type="checkbox" defaultChecked={account?.autoRenew ?? true} className="h-5 w-5 shrink-0" /></label>
              <div className="rounded-xl border border-border bg-card p-5 md:col-span-2 sm:p-6">
                <p className="mb-4 border-b border-border pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Checkout Summary</p>
                <div className="space-y-3 text-sm">
                <DashboardSummary label={`Domain registration (${years} year${years === "1" ? "" : "s"})`} value={quote ? money(quote.currency, quote.baseAmountMinor) : "Loading..."} />
                <DashboardSummary label="Subtotal" value={quote ? money(quote.currency, quote.subtotalMinor) : "-"} />
                <DashboardSummary label={`VAT (${quote?.vatPercent ?? 7.5}%)`} value={quote ? money(quote.currency, quote.vatAmountMinor) : "-"} />
                {quote?.processingFeeMinor ? <DashboardSummary label={`${quote.provider === "stripe" ? "Stripe" : "Paystack"} processing`} value={money(quote.currency, quote.processingFeeMinor)} /> : null}
                </div>
                <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-4 text-foreground"><strong className="text-sm uppercase tracking-widest">Total</strong><span className="text-right text-2xl font-extrabold">{quote ? money(quote.currency, quote.totalAmountMinor) : "-"}</span></div>
                {quote ? <p className="mt-3 text-xs text-muted-foreground">Payment via {quote.provider === "stripe" ? "Stripe" : "Paystack"}{quote.exchangeRateNgnPerUnit ? ` · Converted at ₦${quote.exchangeRateNgnPerUnit.toLocaleString("en-NG")} per ${quote.currency}${quote.fxBufferPercent ? ` plus ${quote.fxBufferPercent}% FX buffer` : ""}` : ""}.</p> : null}
              </div>
            </div>
            </div>
            <div className="border-t border-border bg-muted/20 px-6 py-5 sm:flex sm:items-center sm:justify-between sm:px-8"><p className="mb-3 text-xs text-muted-foreground sm:mb-0">You will continue to the secure payment provider.</p><button disabled={!quote || Boolean(busy)} className="btn-primary w-full justify-center sm:w-auto">{busy === "checkout" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing payment...</> : "Proceed to Payment"}</button></div>
            {!account ? <p className="mt-4 text-sm font-bold text-amber-600">Sign in to your student dashboard before continuing.</p> : null}
            {error ? <p className="mt-4 text-sm font-bold text-destructive">{error}</p> : null}
          </form>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <main className="min-h-screen bg-[#0a1224] pb-24 text-white">
      <section className="site-container pb-8 pt-16 text-center sm:pt-24">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-blue-100"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Registrar services active</p>
        <h1 className="mx-auto mt-7 max-w-4xl font-heading text-4xl font-black tracking-tight sm:text-6xl">Find the perfect domain <span className="text-cyan-300">to power your idea.</span></h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-blue-100/80">Search live registrar inventory, pay securely, and manage the domain from your student dashboard.</p>
        <div className="mx-auto mt-10 flex max-w-4xl flex-col gap-3 rounded-3xl bg-white p-3 shadow-2xl sm:flex-row sm:rounded-full">
          <label className="flex flex-1 items-center gap-3 px-4"><Globe2 className="h-6 w-6 text-slate-500" /><span className="sr-only">Domain name</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(false) } }} className="w-full border-0 bg-transparent py-3 text-lg font-bold text-slate-950 outline-none" placeholder="myawesomebrand.com" /></label>
          <button type="button" onClick={() => void search(true)} disabled={Boolean(busy)} className="btn-secondary justify-center border-0 bg-slate-100 text-slate-950"><Sparkles className="mr-2 h-4 w-4" /> {busy === "suggest" ? "Suggesting..." : "AI Suggest"}</button>
          <button type="button" onClick={() => void search(false)} disabled={Boolean(busy)} className="btn-primary justify-center rounded-full"><Search className="mr-2 h-4 w-4" /> {busy === "search" ? "Checking..." : "Search"}</button>
        </div>
        {message ? <p className="mt-6 font-semibold text-emerald-300">{message}</p> : null}
        {error && !selected ? <p className="mt-6 font-semibold text-red-300">{error}</p> : null}
      </section>

      {suggestions.length ? <section className="site-container grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">{suggestions.map((item) => <button key={item.domainName} disabled={!item.available} onClick={() => choose(item.domainName || "")} className={`rounded-xl border p-4 text-left font-bold ${item.available ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20" : "cursor-not-allowed border-white/10 bg-white/5 text-blue-100/50"}`}>{item.domainName}<span className="mt-1 block text-xs font-medium">{item.available ? "Available" : "Unavailable"}</span></button>)}</section> : null}

      {selected ? <form action={checkout} className="site-container mt-8 grid max-w-5xl gap-8 lg:grid-cols-[1fr_340px]">
        <section className="rounded-3xl border border-white/10 bg-[#0f1a33] p-6 sm:p-8">
          <div className="flex items-center gap-3"><CheckCircle2 className="h-6 w-6 text-emerald-400" /><div><p className="text-xs font-black uppercase tracking-widest text-blue-200/70">Selected domain</p><h2 className="mt-1 text-2xl font-black">{selected}</h2></div></div>
          <h3 className="mt-8 font-heading text-xl font-black">Registrant details</h3>
          <p className="mt-2 text-sm text-blue-100/70">The registrar requires these ownership details. Your dashboard name and email are used automatically.</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <ReadOnly label="Full name" value={account?.fullName || "Sign in required"} /><ReadOnly label="Email" value={account?.email || "Sign in required"} />
            <Field name="address1" label="Address" placeholder="Street address" /><Field name="city" label="City" />
            <Field name="state" label="State / Province" /><label className="block"><span className="label text-blue-100">Country</span><PremiumPicker className="mt-2 text-slate-950" name="country" value={country} options={countryOptions} onChange={(event) => { const value = event.target.value; setCountry(value); setPhoneCc(countries.find(([code]) => code === value)?.[2] || "") }} required /></label>
            <Field name="postalCode" label="Postal code" /><Field name="phone" label="Phone number" />
            <label className="block"><span className="label text-blue-100">Phone country code</span><input value={phoneCc} onChange={(event) => setPhoneCc(event.target.value)} required className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a1224] px-4 py-3 text-white outline-none focus:border-cyan-300" placeholder="234" /></label>
            <label className="block"><span className="label text-blue-100">Registration period</span><PremiumPicker className="mt-2 text-slate-950" name="years" value={years} options={yearOptions} onChange={(event) => setYears(event.target.value)} /></label>
          </div>
          <label className="mt-6 flex items-center justify-between rounded-xl border border-white/10 bg-[#0a1224] p-4"><span><strong className="block">Auto-renew domain</strong><small className="text-blue-100/60">Keep the domain renewing by default.</small></span><input name="autoRenew" type="checkbox" defaultChecked={account?.autoRenew ?? true} className="h-5 w-5" /></label>
        </section>
        <aside className="h-fit rounded-3xl border border-white/10 bg-[#0f1a33] p-6 lg:sticky lg:top-24">
          <p className="text-xs font-black uppercase tracking-widest text-blue-200/70">Checkout summary</p>
          <div className="mt-5 space-y-4 border-y border-white/10 py-5 text-sm"><Summary label={`Domain registration (${years} year${years === "1" ? "" : "s"})`} value={quote ? money(quote.currency, quote.baseAmountMinor) : "Loading..."} /><Summary label="Subtotal" value={quote ? money(quote.currency, quote.subtotalMinor) : "-"} /><Summary label={`VAT (${quote?.vatPercent ?? 7.5}%)`} value={quote ? money(quote.currency, quote.vatAmountMinor) : "-"} />{quote?.processingFeeMinor ? <Summary label="Stripe processing" value={money(quote.currency, quote.processingFeeMinor)} /> : null}</div>
          <div className="mt-5 flex items-center justify-between"><strong>TOTAL</strong><span className="text-2xl font-black">{quote ? money(quote.currency, quote.totalAmountMinor) : "-"}</span></div>
          {quote ? <p className="mt-3 text-xs text-blue-100/60">Payment via {quote.provider === "stripe" ? "Stripe" : "Paystack"}{quote.exchangeRateNgnPerUnit ? ` · Converted at ₦${quote.exchangeRateNgnPerUnit.toLocaleString("en-NG")} per ${quote.currency}${quote.fxBufferPercent ? ` plus ${quote.fxBufferPercent}% FX buffer` : ""}` : ""}.</p> : null}
          <button disabled={!quote || Boolean(busy)} className="btn-primary mt-8 w-full justify-center py-4">{busy === "checkout" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing payment...</> : "Continue to Payment"}</button>
          {!account ? <p className="mt-4 text-sm font-bold text-amber-300">Sign in to your student dashboard before continuing.</p> : null}
          {error ? <p className="mt-4 text-sm font-bold text-red-300">{error}</p> : null}
        </aside>
      </form> : null}
    </main>
  )
}

function Field({ name, label, placeholder }: { name: string; label: string; placeholder?: string }) { return <label className="block"><span className="label text-blue-100">{label}</span><input name={name} required className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a1224] px-4 py-3 text-white outline-none focus:border-cyan-300" placeholder={placeholder || label} /></label> }
function ReadOnly({ label, value }: { label: string; value: string }) { return <div><span className="label text-blue-100">{label}</span><p className="mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold">{value}</p></div> }
function Summary({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4"><span className="text-blue-100/60">{label}</span><strong className="text-right">{value}</strong></div> }
function DashboardField({ name, label, placeholder, type = "text", defaultValue }: { name: string; label: string; placeholder?: string; type?: string; defaultValue?: string }) { return <label className="block min-w-0"><span className="label text-foreground">{label}</span><input name={name} type={type} defaultValue={defaultValue} required className="mt-2 min-w-0 w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground outline-none focus:border-primary" placeholder={placeholder || label} /></label> }
function DashboardSummary({ label, value }: { label: string; value: string }) { return <div className="flex min-w-0 items-start justify-between gap-4"><span className="min-w-0 text-muted-foreground">{label}</span><strong className="shrink-0 text-right text-foreground">{value}</strong></div> }

"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle, 
  Building2, 
  ChevronDown,
  CheckCircle2, 
  Hash, 
  KeyRound, 
  Landmark, 
  Loader2, 
  Search,
  Send, 
  ShieldCheck, 
  UserRound 
} from "lucide-react"

import { showStudentToast } from "@/components/student-dashboard/StudentActionToaster"

type Bank = {
  name: string
  code: string
}

type InitialPayoutAccount = {
  bankCode?: string | null
  bankName?: string | null
  accountName?: string | null
  accountNumberMasked?: string | null
}

function uniqueBanksByCode(input: Bank[]) {
  const seen = new Set<string>()
  return input.filter((bank) => {
    const code = String(bank.code || "").trim()
    if (!code || seen.has(code)) return false
    seen.add(code)
    return true
  })
}

function BankSearchPicker({
  banks,
  value,
  onChange,
  placeholder = "Search and select your bank..."
}: {
  banks: Bank[]
  value: string
  onChange: (bankCode: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selectedBank = banks.find((bank) => bank.code === value)
  const displayValue = open ? query : selectedBank?.name || ""
  const filteredBanks = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return banks
    return banks.filter((bank) => `${bank.name} ${bank.code}`.toLowerCase().includes(needle))
  }, [banks, query])

  function selectBank(bank: Bank) {
    onChange(bank.code)
    setQuery("")
    setOpen(false)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className="brand-focus h-12 w-full rounded-lg border border-border bg-card px-10 pr-12 text-sm font-semibold text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground/60 hover:border-primary/40 hover:bg-background focus:border-primary focus:bg-background focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
          value={displayValue}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          role="combobox"
          aria-controls="affiliate-bank-options"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        <button
          type="button"
          className="absolute inset-y-1.5 right-1.5 flex w-9 items-center justify-center rounded-md border border-border/70 bg-muted/70 text-muted-foreground shadow-sm"
          onClick={() => setOpen((current) => !current)}
          aria-label="Toggle bank list"
        >
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open ? (
        <div id="affiliate-bank-options" role="listbox" className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-2xl ring-1 ring-border/60 dark:bg-slate-950">
          {filteredBanks.length ? (
            filteredBanks.map((bank) => (
              <button
                key={bank.code}
                type="button"
                className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-primary/10 hover:text-primary ${
                  bank.code === value ? "bg-primary/10 text-primary" : "bg-card text-foreground dark:bg-slate-950"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectBank(bank)}
              >
                <span>{bank.name}</span>
                <span className="ml-3 shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{bank.code}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-4 text-sm font-medium text-muted-foreground">No bank matches your search.</div>
          )}
        </div>
      ) : null}
    </div>
  )
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

export function AffiliatePayoutSetup({ initialAccount }: { initialAccount?: InitialPayoutAccount | null }) {
  const router = useRouter()
  const [banks, setBanks] = useState<Bank[]>([])
  const [bankCode, setBankCode] = useState(String(initialAccount?.bankCode || ""))
  const [accountNumber, setAccountNumber] = useState(String(initialAccount?.accountNumberMasked || ""))
  const [accountName, setAccountName] = useState(String(initialAccount?.accountName || ""))
  const [otpCode, setOtpCode] = useState("")
  
  // Feedback & Action Tracking
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [activeAction, setActiveAction] = useState<"resolve" | "otp" | "save" | null>(null)

  const accountDigits = accountNumber.replace(/\D/g, "")
  const bankOptions = useMemo(() => {
    if (banks.length) return banks
    return bankCode && initialAccount?.bankName ? [{ code: bankCode, name: initialAccount.bankName }] : []
  }, [bankCode, banks, initialAccount?.bankName])
  const bankName = useMemo(() => bankOptions.find((bank) => bank.code === bankCode)?.name || initialAccount?.bankName || "", [bankCode, bankOptions, initialAccount?.bankName])

  useEffect(() => {
    fetch("/api/student/affiliate/payout/banks")
      .then((response) => response.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.banks)) setBanks(uniqueBanksByCode(json.banks))
      })
      .catch(() => null)
  }, [])

  async function run(actionName: "resolve" | "otp" | "save", action: () => Promise<string>) {
    setActiveAction(actionName)
    setError("")
    setMessage("")
    try {
      const successMessage = await action()
      setMessage(successMessage)
      showStudentToast({ type: "success", title: "Affiliate payout updated", message: successMessage })
      router.refresh()
    } catch (requestError) {
      const errorMessage = requestError instanceof Error ? requestError.message : "Request failed"
      setError(errorMessage)
      showStudentToast({ type: "error", title: "Affiliate payout failed", message: errorMessage })
    } finally {
      setActiveAction(null)
    }
  }

  async function resolveAccount() {
    await run("resolve", async () => {
      const result = await postJson<{ result: { accountName: string } }>("/api/student/affiliate/payout/resolve", { bankCode, accountNumber })
      setAccountName(result.result.accountName)
      return `Resolved account: ${result.result.accountName}`
    })
  }

  async function sendOtp() {
    await run("otp", async () => {
      const result = await postJson<{ result?: { otpRequired?: boolean; emailMasked?: string; message?: string } }>("/api/student/affiliate/payout/otp", { bankCode, accountNumber })
      if (result.result?.otpRequired === false) return result.result.message || "No payout account change detected."
      return result.result?.emailMasked
        ? `Verification code sent to ${result.result.emailMasked}.`
        : "Verification code sent to your account email."
    })
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await run("save", async () => {
      const result = await postJson<{ result: { accountName: string; accountNumberMasked: string } }>("/api/student/affiliate/payout/save", {
        bankCode,
        bankName,
        accountNumber,
        accountName,
        otpCode
      })
      return `Payout account saved successfully: ${result.result.accountNumberMasked}.`
    })
  }

  const isLoading = activeAction !== null

  return (
    <div className="mt-6">
      <form onSubmit={save} className="grid gap-6">
        
        {/* Step 1: Account Details */}
        <div className="rounded-xl border border-border bg-background p-5 transition-colors hover:border-primary/20 sm:p-6">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <span className="text-xs font-black">1</span>
            </div>
            <h3 className="font-heading text-lg font-bold text-foreground">Account Details</h3>
          </div>
          
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <Landmark className="h-3.5 w-3.5" /> Select Bank
              </span>
              <BankSearchPicker
                banks={bankOptions}
                value={bankCode}
                onChange={setBankCode}
              />
            </label>
            
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <Hash className="h-3.5 w-3.5" /> Account Number
              </span>
              <input 
                className="w-full rounded-md border border-input bg-background/50 px-4 py-3 text-sm font-medium outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary" 
                value={accountNumber} 
                onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, "").slice(0, 10))} 
                placeholder={initialAccount?.accountNumberMasked || "10-digit number"} 
                required 
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <button 
              type="button" 
              className="btn-secondary w-full sm:w-auto" 
              onClick={resolveAccount} 
              disabled={isLoading || !bankCode || accountDigits.length < 10}
            >
              {activeAction === "resolve" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building2 className="mr-2 h-4 w-4" />}
              Resolve Account Name
            </button>
          </div>
        </div>

        {/* Step 2: Verification & Security */}
        <div className="rounded-xl border border-border bg-background p-5 transition-colors hover:border-primary/20 sm:p-6">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <span className="text-xs font-black">2</span>
            </div>
            <h3 className="font-heading text-lg font-bold text-foreground">Verification</h3>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <UserRound className="h-3.5 w-3.5" /> Account Name
              </span>
              <input 
                className="w-full rounded-md border border-input bg-background/50 px-4 py-3 text-sm font-medium outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary" 
                value={accountName} 
                onChange={(event) => setAccountName(event.target.value)} 
                placeholder="Resolved account name will appear here" 
                required 
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" /> Security Code
              </span>
              <input 
                className="w-full rounded-md border border-input bg-background/50 px-4 py-3 text-sm font-medium tracking-widest outline-none transition-colors placeholder:tracking-normal placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary" 
                value={otpCode} 
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))} 
                placeholder="6-digit code" 
              />
            </label>
            
            <div className="flex items-end">
              <button 
                type="button" 
                className="btn-secondary w-full justify-center whitespace-nowrap py-3" 
                onClick={sendOtp} 
                disabled={isLoading || !bankCode || accountDigits.length < 10}
              >
                {activeAction === "otp" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Request OTP
              </button>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {message && (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="font-semibold leading-relaxed">{message}</p>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive animate-in fade-in slide-in-from-bottom-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="font-semibold leading-relaxed">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end border-t border-border pt-4">
          <button 
            type="submit" 
            className="btn-primary w-full shadow-sm sm:w-auto" 
            disabled={isLoading || !bankCode || !accountName || accountDigits.length < 10}
          >
            {activeAction === "save" ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Details...</>
            ) : (
              <><ShieldCheck className="mr-2 h-4 w-4" /> Save Payout Account</>
            )}
          </button>
        </div>
        
      </form>
    </div>
  )
}

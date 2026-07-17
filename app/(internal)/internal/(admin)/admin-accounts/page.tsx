import { 
  CheckCircle2, 
  Key, 
  Lock, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  UserPlus
} from "lucide-react"

import { PasswordField } from "@/components/PasswordField"
import { INTERNAL_PAGE_OPTIONS, listAdminAccounts } from "@/lib/admin-accounts"
import { requireAdmin } from "@/lib/auth"
import { formatDate } from "@/lib/utils"
import { createAdminAccountAction, updateAdminAccountAction } from "./actions"

export const dynamic = "force-dynamic"

function parseAllowedPages(value: string | null | undefined) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean)
}

export default async function InternalAdminAccountsPage() {
  const session = await requireAdmin("/internal/admin-accounts")
  const accounts = await listAdminAccounts()

  return (
    <main className="space-y-8 pb-12">
      
      {/* Header */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">System Security</p>
          <h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Admin User Management
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Provision staff accounts, enforce page-level access controls, manage active sessions, and execute password resets.
          </p>
        </div>
        
        {/* Read-Only Alert for Non-Owners */}
        {!session.isOwner && (
          <div className="flex max-w-sm items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400 shadow-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs font-medium leading-relaxed">
              <span className="font-bold">Restricted View.</span> Only the system owner can provision new accounts or modify existing permissions.
            </p>
          </div>
        )}
      </div>

      {/* Account Provisioning Module (Owner Only) */}
      {session.isOwner && (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/20 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-heading text-xl font-black text-foreground">Provision New Admin</h2>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  Create a new staff profile and assign their initial access clearance.
                </p>
              </div>
            </div>
          </div>
          
          <form action={createAdminAccountAction} className="p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Full Name</span>
                <input name="fullName" placeholder="Jane Doe" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" required />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email Address</span>
                <input name="email" type="email" placeholder="jane@example.com" className="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" required />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Temporary Password</span>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <PasswordField name="password" minLength={12} placeholder="Min. 12 characters" inputClassName="w-full rounded-md border border-input bg-background/50 px-4 py-2.5 pl-9 pr-12 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" required />
                </div>
              </label>
            </div>
            
            <div className="mt-8">
              <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Initial Page Permissions</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {INTERNAL_PAGE_OPTIONS.map((option) => (
                  <label key={`new-${option.path}`} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-muted/10 px-4 py-3 transition-colors hover:bg-muted/30">
                    <input type="checkbox" name="allowedPages" value={option.path} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                    <span className="text-sm font-bold text-foreground">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="mt-8 flex justify-end border-t border-border pt-6">
              <button className="btn-primary w-full justify-center shadow-sm sm:w-auto" type="submit">
                <UserPlus className="mr-2 h-4 w-4" /> Create Admin Account
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Admin Registry */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Registered Administrators
          </h2>
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {accounts.length} Profiles
          </span>
        </div>

        <div className="grid gap-6">
          {accounts.map((account) => {
            const allowedPages = parseAllowedPages(account.allowedPages)
            const canEditIdentity = session.isOwner && !account.isOwner
            const canEditPermissions = session.isOwner && !account.isOwner

            return (
              <article key={account.adminUuid} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:border-primary/20">
                <form action={updateAdminAccountAction} className="flex flex-col">
                  <input type="hidden" name="adminUuid" value={account.adminUuid} />
                  
                  {/* Account Identity Header */}
                  <div className="flex flex-col gap-6 border-b border-border bg-muted/10 p-6 lg:flex-row lg:items-start lg:justify-between sm:p-8">
                    <div className="flex items-start gap-4">
                      <div className={`mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${account.isOwner ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {account.isOwner ? <ShieldCheck className="h-6 w-6" /> : <Shield className="h-6 w-6" />}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest shadow-sm ${
                            account.isActive 
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                              : "border-border bg-muted text-muted-foreground"
                          }`}>
                            {account.isActive ? "Active Profile" : "Inactive"}
                          </span>
                          {account.isOwner && (
                            <span className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary shadow-sm">
                              System Owner
                            </span>
                          )}
                        </div>
                        <h3 className="font-heading text-xl font-black text-foreground">{account.fullName}</h3>
                        <p className="mt-1 font-medium text-muted-foreground">{account.email}</p>
                        <p className="mt-2 text-xs font-semibold text-muted-foreground">
                          Last Authentication: {formatDate(account.lastLoginAt)}
                        </p>
                      </div>
                    </div>

                    {/* Quick Management Actions (Owner only, non-owner rows) */}
                    {canEditIdentity && (
                      <div className="flex w-full shrink-0 flex-col gap-3 rounded-xl border border-border bg-background p-4 shadow-inner lg:w-80">
                        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-4 py-2.5 transition-colors hover:bg-muted/40">
                          <span className="text-xs font-bold text-foreground">Account Active Status</span>
                          <input type="checkbox" name="isActive" defaultChecked={account.isActive} className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <PasswordField
                            name="password" 
                            minLength={12}
                            placeholder="Reset password (Optional)" 
                            inputClassName="w-full rounded-md border border-input bg-background/50 px-3 py-2 pl-9 pr-11 text-xs font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary" 
                          />
                        </div>
                        <button className="btn-secondary w-full justify-center text-xs shadow-sm" type="submit">
                          Update Core Settings
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Permissions Grid */}
                  <div className="p-6 sm:p-8">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Page Access Clearance
                      </h4>
                      {canEditPermissions && (
                        <button className="btn-secondary h-8 px-4 text-[10px] shadow-sm" type="submit">
                          Save Permissions
                        </button>
                      )}
                    </div>
                    
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {INTERNAL_PAGE_OPTIONS.map((option) => {
                        const isChecked = account.isOwner || allowedPages.includes(option.path)
                        
                        return (
                          <label 
                            key={`${account.adminUuid}-${option.path}`} 
                            className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                              canEditPermissions 
                                ? 'cursor-pointer border-border bg-background hover:border-primary/30 hover:bg-muted/10 shadow-sm' 
                                : 'cursor-not-allowed border-transparent bg-muted/30 opacity-80'
                            }`}
                          >
                            <input 
                              type="checkbox" 
                              name="allowedPages" 
                              value={option.path} 
                              defaultChecked={isChecked} 
                              disabled={!canEditPermissions} 
                              className="h-4 w-4 rounded border-input text-primary focus:ring-primary disabled:opacity-50" 
                            />
                            <span className={`text-sm font-bold ${isChecked ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {option.label}
                            </span>
                            {isChecked && !canEditPermissions && account.isOwner && (
                              <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-primary opacity-50" />
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  
                </form>
              </article>
            )
          })}
        </div>
      </section>
      
    </main>
  )
}

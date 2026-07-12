import { 
  AlertTriangle, 
  CheckCircle2, 
  History,
  KeyRound, 
  Lock,
  RefreshCw,
  Save,
  Settings,
  ShieldAlert
} from "lucide-react"

import { listAdminSettings, listAdminSettingsAudit } from "@/lib/admin-settings"
import { requireAdmin } from "@/lib/auth"
import { formatDate } from "@/lib/utils"
import { saveAdminSettingsAction } from "./actions"

export const dynamic = "force-dynamic"

export default async function InternalSettingsPage() {
  const session = await requireAdmin()
  const [settings, audit] = await Promise.all([listAdminSettings(), listAdminSettingsAudit(80)])
  
  const grouped = new Map<string, typeof settings>()
  for (const setting of settings) {
    const list = grouped.get(setting.category) || []
    list.push(setting)
    grouped.set(setting.category, list)
  }

  return (
    <main className="space-y-8 pb-32">
      
      {/* Header */}
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">System Architecture</p>
          <h1 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Environment Configuration
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Runtime database overrides for payments, cloud storage, media ingestion, registrar APIs, and core operational parameters.
          </p>
        </div>
      </div>

      {/* Permissions Alert */}
      {!session.isOwner && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-5 text-amber-600 dark:text-amber-400 shadow-sm">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h3 className="font-heading text-sm font-bold">Restricted Access Mode</h3>
            <p className="mt-1 text-xs font-medium leading-relaxed">
              Only the system owner account can modify these environment overrides. You are currently in read-only mode and can audit the active configuration topology.
            </p>
          </div>
        </div>
      )}

      {/* Configuration Form */}
      <form action={saveAdminSettingsAction} className="space-y-8">
        {[...grouped.entries()].map(([category, items]) => (
          <section key={category} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-border bg-muted/20 p-6 sm:flex-row sm:items-center sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-heading text-xl font-black capitalize text-foreground">{category} Settings</h2>
                </div>
              </div>
              <div className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-center shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active Keys</p>
                <p className="font-heading text-lg font-black text-foreground">{items.length}</p>
              </div>
            </div>
            
            <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-2">
              {items.map((setting) => (
                <label 
                  key={setting.key} 
                  className={`flex flex-col justify-between rounded-xl border p-5 transition-colors ${
                    !session.isOwner ? 'border-border bg-muted/10 opacity-80' : 'border-border bg-background hover:border-primary/30'
                  }`}
                >
                  {/* Field Header */}
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <span className="font-mono text-xs font-bold text-foreground break-all">{setting.key}</span>
                    <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest shadow-sm ${
                      setting.source === "database" 
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                        : "border-border bg-muted text-muted-foreground"
                    }`}>
                      {setting.source}
                    </span>
                  </div>
                  
                  {/* Input Element */}
                  <div className="relative">
                    {setting.secret && (
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                    )}
                    <input
                      name={`setting:${setting.key}`}
                      type={setting.secret ? "password" : "text"}
                      defaultValue={setting.secret ? "" : setting.value}
                      placeholder={setting.secret && setting.isSet ? "••••••••••••••••" : "Not configured"}
                      disabled={!session.isOwner}
                      className={`w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary shadow-sm disabled:cursor-not-allowed ${setting.secret ? 'pl-9 tracking-widest' : ''}`}
                    />
                  </div>
                  
                  {/* Field Metadata */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {setting.secret ? (
                      setting.isSet ? (
                        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Secret Configured
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" /> Secret Missing
                        </span>
                      )
                    ) : (
                      setting.isSet && (
                        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Value Set
                        </span>
                      )
                    )}
                    
                    {setting.secret && session.isOwner && setting.isSet && (
                      <span className="flex items-center gap-1.5 text-muted-foreground/70">
                        <KeyRound className="h-3 w-3" /> Leave blank to keep current
                      </span>
                    )}
                    
                    {setting.restartSensitive && (
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <RefreshCw className="h-3 w-3" /> Requires Reboot
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </section>
        ))}

        {/* Sticky Action Footer */}
        {session.isOwner && (
          <div className="fixed bottom-6 left-4 right-4 z-40 mx-auto flex max-w-[1500px] flex-col items-center justify-between gap-4 rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-xl sm:flex-row sm:px-6 lg:left-[316px] lg:right-8 lg:mx-0">
            <div>
              <p className="font-heading text-sm font-bold text-foreground">
                Unsaved Configuration Changes
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Apply your overrides to update the live environment state.
              </p>
            </div>
            <button className="btn-primary w-full justify-center shadow-lg sm:w-auto" type="submit">
              <Save className="mr-2 h-4 w-4" /> Save Global Configuration
            </button>
          </div>
        )}
      </form>

      {/* Audit Ledger */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b border-border bg-muted/20 p-6 sm:p-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-black text-foreground">Configuration Audit Log</h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">Historical ledger of all environment overrides and state changes.</p>
          </div>
        </div>
        
        <div className="max-h-[500px] overflow-auto bg-background scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
          <table className="w-full min-w-[54rem] text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-10 border-b border-border bg-card/90 text-[10px] font-bold uppercase tracking-widest text-muted-foreground backdrop-blur-md">
              <tr>
                <th className="px-6 py-4">Environment Key</th>
                <th className="px-6 py-4">Action Event</th>
                <th className="px-6 py-4">Executed By</th>
                <th className="px-6 py-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {audit.length ? audit.map((item) => (
                <tr key={`${item.settingKey}-${item.createdAt.toISOString()}-${item.actionType}`} className="transition-colors hover:bg-muted/5">
                  <td className="px-6 py-4 font-mono text-xs font-bold text-foreground">
                    {item.settingKey}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest shadow-sm ${
                      item.actionType === 'set' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    }`}>
                      {item.actionType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-muted-foreground">
                    {item.updatedBy || "System Admin"}
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-medium text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-sm font-semibold text-muted-foreground">
                    No configuration changes have been recorded in the audit ledger.
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
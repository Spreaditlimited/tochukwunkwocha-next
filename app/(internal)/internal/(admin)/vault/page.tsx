import { requireAdmin } from "@/lib/auth"
import { readVaultAccess, readVaultCatalog, readVaultSubscribers } from "@/lib/vault-storage"
import { VaultManager } from "./VaultManager"
import { VaultAccessManager } from "./VaultAccessManager"
import { VaultSubscribersManager } from "./VaultSubscribersManager"

export const dynamic = "force-dynamic"

export default async function VaultPage() {
  const session = await requireAdmin("/internal/vault")
  let access = null
  let accessError = ""
  let subscribers = null
  let subscribersError = ""
  if (session.isOwner) {
    try {
      const state = await readVaultAccess()
      access = { configured: !!state.record, updatedAt: state.record?.updatedAt || null, updatedBy: state.record?.updatedBy || null }
    } catch { accessError = "The monthly access code could not be loaded. Refresh to try again." }
    try { subscribers = await readVaultSubscribers() }
    catch { subscribersError = "The subscriber list could not be loaded. Refresh to try again." }
  }
  let data
  let error = ""
  try { data = await readVaultCatalog() }
  catch (cause) { error = cause instanceof Error ? cause.message : "Vault storage is unavailable." }
  return <div className="space-y-6">
    <header><p className="eyebrow text-primary">Members only</p><h2 className="mt-2 font-heading text-3xl font-black">Inner Circle Vault</h2><p className="mt-3 max-w-2xl text-sm text-muted-foreground">Upload documents for your subscribers. Publish them to the vault or keep them as private drafts.</p><a href="https://vault.tochukwunkwocha.com" target="_blank" rel="noreferrer" className="btn-secondary mt-4">Open member vault ↗</a></header>
    {session.isOwner ? <VaultAccessManager initialStatus={access} initialError={accessError} /> : null}
    {session.isOwner ? <VaultSubscribersManager initialState={subscribers} initialError={subscribersError} /> : null}
    {error ? <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">{error}</p> : <VaultManager initialCatalog={data!.catalog} initialEtag={data!.etag} />}
  </div>
}

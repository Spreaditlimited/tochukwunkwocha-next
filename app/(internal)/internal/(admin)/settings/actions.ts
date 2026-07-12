"use server"

import { revalidatePath } from "next/cache"

import { upsertAdminSettings } from "@/lib/admin-settings"
import { requireAdmin } from "@/lib/auth"
import { setInternalToast } from "@/lib/internal-toast"

export async function saveAdminSettingsAction(formData: FormData) {
  const session = await requireAdmin()
  if (!session.isOwner) throw new Error("Only the owner can edit settings.")
  const entries: Array<{ key: string; value: string }> = []
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("setting:")) continue
    entries.push({ key: key.slice("setting:".length), value: String(value || "") })
  }
  await upsertAdminSettings(entries, session.email)
  await setInternalToast({ title: "Settings saved", message: "Internal configuration values have been updated." })
  revalidatePath("/internal/settings")
}

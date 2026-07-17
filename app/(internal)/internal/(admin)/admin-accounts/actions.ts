"use server"

import { revalidatePath } from "next/cache"

import { createAdminAccount, updateAdminAccount } from "@/lib/admin-accounts"
import { requireAdmin } from "@/lib/auth"
import { setInternalToast } from "@/lib/internal-toast"

function selectedPages(formData: FormData) {
  return formData.getAll("allowedPages").map(String).filter(Boolean)
}

export async function createAdminAccountAction(formData: FormData) {
  const session = await requireAdmin("/internal/admin-accounts")
  if (!session.isOwner) throw new Error("Only owner can create admin accounts.")
  await createAdminAccount({
    fullName: String(formData.get("fullName") || ""),
    email: String(formData.get("email") || ""),
    password: String(formData.get("password") || ""),
    allowedPages: selectedPages(formData),
    createdBy: session.email
  })
  await setInternalToast({ title: "Admin account created", message: "The new admin user can now access the permitted internal pages." })
  revalidatePath("/internal/admin-accounts")
}

export async function updateAdminAccountAction(formData: FormData) {
  const session = await requireAdmin("/internal/admin-accounts")
  if (!session.isOwner) throw new Error("Only owner can update admin accounts.")
  await updateAdminAccount({
    adminUuid: String(formData.get("adminUuid") || ""),
    isActive: formData.get("isActive") === "on",
    allowedPages: selectedPages(formData),
    password: String(formData.get("password") || "")
  })
  await setInternalToast({ title: "Admin account updated", message: "Permissions and account status have been saved." })
  revalidatePath("/internal/admin-accounts")
}

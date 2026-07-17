"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth"
import { resetStudentDevices } from "@/lib/admin-learning-support"
import { setInternalToast } from "@/lib/internal-toast"

export async function resetSecurityStudentDevicesAction(formData: FormData) {
  await requireAdmin("/internal/security")
  await resetStudentDevices({
    accountId: String(formData.get("accountId") || ""),
    email: String(formData.get("email") || "")
  })
  await setInternalToast({ title: "Trusted devices reset", message: "The selected student's trusted devices have been cleared." })
  revalidatePath("/internal/security")
  revalidatePath("/internal")
}

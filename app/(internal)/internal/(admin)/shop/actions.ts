"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAdmin } from "@/lib/auth"
import { setInternalToast } from "@/lib/internal-toast"
import {
  updateShopShipmentFromForm,
  upsertShopProductFromForm,
  upsertShopVariantFromForm
} from "@/lib/shop"

async function finish(message: string, target = "/internal/shop") {
  revalidatePath("/shop")
  revalidatePath("/dashboard/shop")
  revalidatePath("/dashboard/purchases")
  revalidatePath("/internal/shop")
  await setInternalToast({ title: "Shop updated", message })
  redirect(target)
}

export async function saveShopProductAction(formData: FormData) {
  await requireAdmin("/internal/shop")
  try {
    const product = await upsertShopProductFromForm(formData)
    await finish("The product catalogue and SEO page have been refreshed.", `/internal/shop?product=${product.productUuid}`)
  } catch (error) {
    await setInternalToast({
      type: "error",
      title: "Product not saved",
      message: error instanceof Error ? error.message : "Check the product fields."
    })
    redirect("/internal/shop?error=product")
  }
}

export async function saveShopVariantAction(formData: FormData) {
  await requireAdmin("/internal/shop")
  try {
    await upsertShopVariantFromForm(formData)
    await finish("The product format, price and availability have been saved.")
  } catch (error) {
    await setInternalToast({
      type: "error",
      title: "Product format not saved",
      message: error instanceof Error ? error.message : "Check the product format fields."
    })
    redirect("/internal/shop?error=variant")
  }
}

export async function updateShopShipmentAction(formData: FormData) {
  await requireAdmin("/internal/shop")
  try {
    await updateShopShipmentFromForm(formData)
    await finish("The customer delivery status has been updated.")
  } catch (error) {
    await setInternalToast({
      type: "error",
      title: "Delivery not updated",
      message: error instanceof Error ? error.message : "Check the delivery fields."
    })
    redirect("/internal/shop?error=shipment")
  }
}

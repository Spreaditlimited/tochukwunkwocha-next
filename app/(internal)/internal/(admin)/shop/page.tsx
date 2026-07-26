import Link from "next/link"
import { ExternalLink, PackageCheck, Plus, Save, ShoppingBag } from "lucide-react"

import { formatShopMoney, listAdminShopOrders, listAdminShopProducts } from "@/lib/shop"
import { formatDate } from "@/lib/utils"
import {
  saveShopProductAction,
  saveShopVariantAction,
  updateShopShipmentAction
} from "./actions"

export const dynamic = "force-dynamic"

const fieldClass =
  "mt-2 w-full rounded-lg border border-input bg-background px-3.5 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
const labelClass = "block text-[10px] font-black uppercase tracking-widest text-muted-foreground"

export default async function InternalShopPage() {
  const [products, orders] = await Promise.all([
    listAdminShopProducts(),
    listAdminShopOrders()
  ])

  return (
    <main className="space-y-8 pb-12">
      <div className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-primary">Commerce</p>
          <h1 className="mt-2 flex items-center gap-3 font-heading text-3xl font-black text-foreground">
            <ShoppingBag className="h-7 w-7 text-primary" /> Shop Management
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Manage product content, selling formats, prices, digital files and physical deliveries.
          </p>
        </div>
        <Link href="/shop" className="btn-secondary shrink-0">
          <ExternalLink className="h-4 w-4" /> Public shop
        </Link>
      </div>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Plus className="h-5 w-5 text-primary" />
            <h2 className="font-heading text-xl font-black text-foreground">Create a product</h2>
          </div>
          <form action={saveShopProductAction} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className={`${labelClass} sm:col-span-2`}>Title<input name="title" className={fieldClass} required /></label>
            <label className={labelClass}>Slug<input name="slug" className={fieldClass} placeholder="expense-tracker-workbook" required /></label>
            <label className={labelClass}>Category<input name="category" defaultValue="workbooks" className={fieldClass} /></label>
            <label className={`${labelClass} sm:col-span-2`}>Subtitle<input name="subtitle" className={fieldClass} /></label>
            <label className={`${labelClass} sm:col-span-2`}>Short description<textarea name="shortDescription" rows={3} className={fieldClass} required /></label>
            <label className={`${labelClass} sm:col-span-2`}>Cover image URL<input name="coverImageUrl" className={fieldClass} placeholder="/shop/workbooks/cover.webp" /></label>
            <label className={`${labelClass} sm:col-span-2`}>Rich product content<textarea name="bodyContent" rows={9} className={fieldClass} placeholder={"## What you will build\n\nExplain the product in clear sections."} /></label>
            <label className={`${labelClass} sm:col-span-2`}>FAQ JSON<textarea name="faqJson" rows={4} className={fieldClass} placeholder={'[{"question":"Who is this for?","answer":"Beginners."}]'} /></label>
            <label className={labelClass}>SEO title<input name="seoTitle" className={fieldClass} /></label>
            <label className={labelClass}>Sort order<input name="sortOrder" type="number" defaultValue="0" className={fieldClass} /></label>
            <label className={`${labelClass} sm:col-span-2`}>SEO description<textarea name="seoDescription" rows={2} className={fieldClass} /></label>
            <label className={labelClass}>Status<select name="status" className={fieldClass}><option value="draft">Draft</option><option value="published">Published</option></select></label>
            <label className="mt-7 flex items-center gap-2 text-sm font-bold text-foreground"><input name="featured" type="checkbox" /> Featured product</label>
            <button className="btn-primary sm:col-span-2" type="submit"><Save className="h-4 w-4" /> Save product</button>
          </form>
        </article>

        <div className="space-y-5">
          {products.map((product) => (
            <article key={product.productUuid} className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-primary">{product.status}</p>
                  <h2 className="mt-1 font-heading text-xl font-black text-foreground">{product.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">/shop/{product.slug}</p>
                </div>
                <Link href={`/shop/${product.slug}`} className="btn-secondary py-2 text-xs">Preview</Link>
              </div>
              <form action={saveShopProductAction} className="mt-5 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="productUuid" value={product.productUuid} />
                <label className={labelClass}>Title<input name="title" defaultValue={product.title} className={fieldClass} required /></label>
                <label className={labelClass}>Slug<input name="slug" defaultValue={product.slug} className={fieldClass} required /></label>
                <label className={`${labelClass} sm:col-span-2`}>Subtitle<input name="subtitle" defaultValue={product.subtitle || ""} className={fieldClass} /></label>
                <label className={`${labelClass} sm:col-span-2`}>Short description<textarea name="shortDescription" rows={3} defaultValue={product.shortDescription} className={fieldClass} required /></label>
                <label className={`${labelClass} sm:col-span-2`}>Cover image URL<input name="coverImageUrl" defaultValue={product.coverImageUrl || ""} className={fieldClass} /></label>
                <label className={`${labelClass} sm:col-span-2`}>Rich product content<textarea name="bodyContent" rows={7} defaultValue={product.bodyContent || ""} className={fieldClass} /></label>
                <label className={`${labelClass} sm:col-span-2`}>FAQ JSON<textarea name="faqJson" rows={3} defaultValue={product.faqJson || ""} className={fieldClass} /></label>
                <label className={labelClass}>Category<input name="category" defaultValue={product.category} className={fieldClass} /></label>
                <label className={labelClass}>Sort order<input name="sortOrder" type="number" defaultValue={product.sortOrder} className={fieldClass} /></label>
                <label className={labelClass}>SEO title<input name="seoTitle" defaultValue={product.seoTitle || ""} className={fieldClass} /></label>
                <label className={labelClass}>Status<select name="status" defaultValue={product.status} className={fieldClass}><option value="draft">Draft</option><option value="published">Published</option></select></label>
                <label className={`${labelClass} sm:col-span-2`}>SEO description<textarea name="seoDescription" rows={2} defaultValue={product.seoDescription || ""} className={fieldClass} /></label>
                <label className="flex items-center gap-2 text-sm font-bold text-foreground"><input name="featured" type="checkbox" defaultChecked={product.featured} /> Featured</label>
                <button className="btn-secondary justify-center" type="submit"><Save className="h-4 w-4" /> Update product</button>
              </form>

              <div className="mt-6 border-t border-border pt-5">
                <h3 className="text-sm font-black text-foreground">Selling formats</h3>
                {product.variants.length ? (
                  <div className="mt-3 space-y-2">
                    {product.variants.map((variant) => (
                      <form key={variant.variantUuid} action={saveShopVariantAction} className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-3">
                        <input type="hidden" name="productUuid" value={product.productUuid} />
                        <input type="hidden" name="variantUuid" value={variant.variantUuid} />
                        <label className={labelClass}>Format title<input name="variantTitle" defaultValue={variant.title} className={fieldClass} required /></label>
                        <label className={labelClass}>SKU<input name="sku" defaultValue={variant.sku} className={fieldClass} required /></label>
                        <label className={labelClass}>Fulfilment<select name="fulfillmentType" defaultValue={variant.fulfillmentType} className={fieldClass}><option value="digital">Digital</option><option value="physical">Physical</option></select></label>
                        <label className={labelClass}>Currency<select name="currency" defaultValue={variant.currency} className={fieldClass}><option value="NGN">NGN</option><option value="USD">USD</option><option value="GBP">GBP</option><option value="EUR">EUR</option></select></label>
                        <label className={labelClass}>Price<input name="priceMajor" type="number" min="0" step="0.01" defaultValue={(variant.priceMinor / 100).toFixed(2)} className={fieldClass} required /></label>
                        <label className={labelClass}>Physical stock<input name="stockQuantity" type="number" min="0" defaultValue={variant.stockQuantity ?? ""} className={fieldClass} /></label>
                        <label className={`${labelClass} sm:col-span-2`}>Private digital asset path<input name="digitalAssetKey" defaultValue={variant.digitalAssetKey || ""} className={fieldClass} /></label>
                        <label className={labelClass}>Download filename<input name="digitalFilename" defaultValue={variant.digitalFilename || ""} className={fieldClass} /></label>
                        <div className="rounded-lg border border-border bg-background p-3 text-xs sm:col-span-3">
                          <p className="font-black text-foreground">Active prices</p>
                          <p className="mt-1 text-muted-foreground">
                            {variant.prices.filter((price) => price.active).map((price) => formatShopMoney(price.amountMinor, price.currency)).join(" · ") || "No active prices yet."}
                          </p>
                          <p className="mt-3 font-black text-foreground">Protected storage</p>
                          <p className="mt-1 text-muted-foreground">
                            {variant.cloudinaryPublicId
                              ? `Cloudinary authenticated asset · ${variant.cloudinaryBytes?.toLocaleString("en")} bytes`
                              : "No authenticated Cloudinary asset attached yet."}
                          </p>
                        </div>
                        <label className="flex items-center gap-2 text-sm font-bold text-foreground"><input name="active" type="checkbox" defaultChecked={variant.active} /> Active</label>
                        <p className="self-center text-sm font-black text-primary">{formatShopMoney(variant.priceMinor, variant.currency)}</p>
                        <button className="btn-secondary justify-center" type="submit"><Save className="h-4 w-4" /> Update format</button>
                      </form>
                    ))}
                  </div>
                ) : null}
                <form action={saveShopVariantAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="productUuid" value={product.productUuid} />
                  <label className={labelClass}>Format title<input name="variantTitle" className={fieldClass} placeholder="Digital PDF" required /></label>
                  <label className={labelClass}>SKU<input name="sku" className={fieldClass} placeholder="PTP-WB01-DIG" required /></label>
                  <label className={labelClass}>Fulfilment<select name="fulfillmentType" className={fieldClass}><option value="digital">Digital</option><option value="physical">Physical</option></select></label>
                  <label className={labelClass}>Currency<select name="currency" className={fieldClass}><option value="NGN">NGN</option><option value="USD">USD</option><option value="GBP">GBP</option><option value="EUR">EUR</option></select></label>
                  <label className={labelClass}>Price (major unit)<input name="priceMajor" type="number" min="0" step="0.01" className={fieldClass} required /></label>
                  <label className={labelClass}>Physical stock<input name="stockQuantity" type="number" min="0" className={fieldClass} /></label>
                  <label className={`${labelClass} sm:col-span-2`}>Private digital asset path<input name="digitalAssetKey" className={fieldClass} placeholder="deliverables/expense-tracker-workbook/file.pdf" /></label>
                  <label className={`${labelClass} sm:col-span-2`}>Download filename<input name="digitalFilename" className={fieldClass} placeholder="Prompt-to-Profit-Workbook-01.pdf" /></label>
                  <label className="flex items-center gap-2 text-sm font-bold text-foreground"><input name="active" type="checkbox" defaultChecked /> Active</label>
                  <button className="btn-secondary justify-center" type="submit"><Plus className="h-4 w-4" /> Add format</button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <PackageCheck className="h-5 w-5 text-primary" />
          <h2 className="font-heading text-xl font-black text-foreground">Recent orders</h2>
        </div>
        <div className="mt-5 space-y-4">
          {orders.length ? orders.map((order) => (
            <article key={order.orderUuid} className="rounded-lg border border-border p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div><p className="text-xs font-black text-primary">{order.orderNumber}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(order.createdAt)}</p></div>
                <div><p className="text-sm font-black text-foreground">{order.customerName}</p><p className="text-xs text-muted-foreground">{order.customerEmail}</p></div>
                <div><p className="text-sm font-black text-foreground">{formatShopMoney(order.totalMinor, order.currency)}</p><p className="text-xs text-muted-foreground">{order.paymentStatus}</p></div>
                <div><p className="text-sm font-black text-foreground">{order.fulfillmentStatus}</p><p className="text-xs text-muted-foreground">{order.items.length} item(s)</p></div>
              </div>
              {order.shipment ? (
                <form action={updateShopShipmentAction} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-5">
                  <input type="hidden" name="orderUuid" value={order.orderUuid} />
                  <label className={labelClass}>Status<select name="shipmentStatus" defaultValue={order.shipment.status} className={fieldClass}><option value="processing">Processing</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option></select></label>
                  <label className={labelClass}>Carrier<input name="carrier" defaultValue={order.shipment.carrier || ""} className={fieldClass} /></label>
                  <label className={labelClass}>Tracking number<input name="trackingNumber" defaultValue={order.shipment.trackingNumber || ""} className={fieldClass} /></label>
                  <label className={labelClass}>Tracking URL<input name="trackingUrl" defaultValue={order.shipment.trackingUrl || ""} className={fieldClass} /></label>
                  <button className="btn-secondary mt-5 justify-center" type="submit">Update delivery</button>
                </form>
              ) : null}
            </article>
          )) : <p className="text-sm text-muted-foreground">No shop orders yet.</p>}
        </div>
      </section>
    </main>
  )
}

import assert from "node:assert/strict"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const sourceFiles = {
  seed: await readFile(path.join(root, "scripts/seed-shop-workbooks.mjs"), "utf8"),
  publish: await readFile(path.join(root, "scripts/publish-shop-workbooks.mjs"), "utf8"),
  upload: await readFile(path.join(root, "scripts/upload-shop-workbooks-cloudinary.mjs"), "utf8"),
  verify: await readFile(path.join(root, "scripts/verify-shop-workbook-assets.mjs"), "utf8")
}
const shopSource = await readFile(path.join(root, "lib/shop.ts"), "utf8")
const shopFormatSource = await readFile(path.join(root, "lib/shop-format.ts"), "utf8")
const shopCardSource = await readFile(path.join(root, "components/shop/ShopProductCard.tsx"), "utf8")
const shopDetailSource = await readFile(path.join(root, "app/(public)/shop/[slug]/page.tsx"), "utf8")
const publicShopSource = await readFile(path.join(root, "app/(public)/shop/page.tsx"), "utf8")
const dashboardShopSource = await readFile(path.join(root, "app/(student)/dashboard/shop/page.tsx"), "utf8")

const workbooks = [
  {
    number: 6,
    slug: "sales-tracker-workbook",
    assetSlug: "sales-tracker",
    pages: 252,
    time: "20–25 hours",
    filename: "Prompt-to-Profit-Workbook-06-Sales-Tracker.pdf"
  },
  {
    number: 7,
    slug: "supplier-management-system-workbook",
    assetSlug: "supplier-management-system",
    pages: 319,
    time: "25–30 hours",
    filename: "Prompt-to-Profit-Workbook-07-Supplier-Management-System.pdf"
  },
  {
    number: 8,
    slug: "order-management-system-workbook",
    assetSlug: "order-management-system",
    pages: 252,
    time: "20–25 hours",
    filename: "Prompt-to-Profit-Workbook-08-Order-Management-System.pdf"
  }
]

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG", "Expected a PNG image")
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  }
}

for (const workbook of workbooks) {
  const paddedNumber = String(workbook.number).padStart(2, "0")
  const sku = `PTP-WB${paddedNumber}-DIG`
  const deliverable = path.join(root, "deliverables", workbook.slug, workbook.filename)
  const cover = path.join(root, "public/shop/workbooks", `${workbook.assetSlug}-cover.png`)
  const mockup = path.join(root, "public/shop/workbooks", `${workbook.assetSlug}-mockup.png`)

  assert.ok((await stat(deliverable)).size > 1_000_000, `${sku} PDF is missing or unexpectedly small`)
  assert.deepEqual(pngDimensions(await readFile(cover)), { width: 1130, height: 1600 })
  assert.deepEqual(pngDimensions(await readFile(mockup)), { width: 1448, height: 1086 })

  assert.match(sourceFiles.seed, new RegExp(`number: ${workbook.number},[\\s\\S]*?slug: "${workbook.slug}"`))
  assert.ok(sourceFiles.seed.includes(workbook.filename), `${sku} is missing from the seed workflow`)
  assert.ok(sourceFiles.publish.includes(`sku: "${sku}"`), `${sku} is missing from the publish workflow`)
  assert.ok(sourceFiles.publish.includes(`pages: ${workbook.pages}`), `${sku} has the wrong page count`)
  assert.ok(sourceFiles.publish.includes(`time: "${workbook.time}"`), `${sku} has the wrong completion time`)
  assert.ok(
    sourceFiles.publish.includes(`cover: "/shop/workbooks/${workbook.assetSlug}-cover.png"`),
    `${sku} has the wrong cover path`
  )
  assert.ok(sourceFiles.upload.includes(`sku: "${sku}"`), `${sku} is missing from the upload workflow`)
  assert.ok(sourceFiles.upload.includes(workbook.filename), `${sku} upload has the wrong PDF`)
  assert.ok(sourceFiles.verify.includes(`"${sku}"`), `${sku} is missing from production verification`)

  console.log(`${sku}: catalogue metadata, protected PDF and shop images are wired`)
}

assert.match(
  shopSource,
  /process\.env\.NODE_ENV === "development"[\s\S]*?status: \{ in: \["published", "draft"\] \}[\s\S]*?status: "published"/,
  "Local development must preview drafts without exposing them in production"
)

assert.doesNotMatch(
  shopFormatSource,
  /-cover\\\.png\$\/,\s*"-mockup\.png"/,
  "Shop workbook covers must not be replaced with 3D mockups"
)
assert.match(shopFormatSource, /-mockup\\\.png\$\/,\s*"-cover\.png"/, "Legacy mockup paths must resolve to flat covers")
assert.match(shopCardSource, /aspect-\[113\/160\]/, "Public and dashboard shop cards must use the flat cover ratio")
assert.match(shopCardSource, /workbook cover/, "Shop cards must describe the flat cover image")
assert.match(shopDetailSource, /aspect-\[113\/160\]/, "Shop details must use the flat cover ratio")
assert.match(shopDetailSource, /workbook cover/, "Shop details must describe the flat cover image")
assert.match(publicShopSource, /lg:grid-cols-4/, "The public shop must show four workbooks per desktop row")
assert.match(dashboardShopSource, /xl:grid-cols-4/, "The student shop must show four workbooks per desktop row")

console.log("Shop workbook catalogue smoke test passed.")

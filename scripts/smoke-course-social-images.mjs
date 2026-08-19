import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const [brand, seo, courseCatalogue, courseDetail, blogDetail, shopDetail] = await Promise.all([
  read("lib/brand.ts"),
  read("lib/site-seo.ts"),
  read("app/(public)/courses/page.tsx"),
  read("app/(public)/courses/[slug]/page.tsx"),
  read("app/(public)/blog/[slug]/page.tsx"),
  read("app/(public)/shop/[slug]/page.tsx")
])

assert.match(brand, /ogDefault:\s*["']\/brand\/tochukwu-tech-og-default\.png["']/)
assert.match(seo, /image \|\| brand\.assets\.ogDefault/)
assert.match(courseCatalogue, /image:\s*brand\.assets\.ogDefault/)
assert.match(courseDetail, /image:\s*brand\.assets\.ogDefault/)
assert.doesNotMatch(courseDetail, /image:\s*course\?\.logo/)
assert.match(blogDetail, /image:\s*imageSrc/)
assert.match(shopDetail, /image:\s*shopProductImageUrl\(product\.coverImageUrl\)/)

console.log("Course social-image smoke checks passed.")

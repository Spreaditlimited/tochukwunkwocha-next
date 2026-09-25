import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import ts from "typescript"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const source = read("lib/blog.ts")
// Exercise the real list query with a database double, without loading live services.
const listSource = source.slice(source.indexOf("export async function listCmsPostsPage"), source.indexOf("export async function makeUniqueBlogSlug"))
function setup(total = 45) {
  const calls = {}
  const prisma = { tochukwuBlogPost: {
    count: async (args) => { calls.count = args; return total },
    findMany: async (args) => { calls.list = args; return [] }
  } }
  const module = { exports: {} }
  const compiled = ts.transpileModule(listSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function("exports", "prisma", compiled)(module.exports, prisma)
  return { list: module.exports.listCmsPostsPage, calls }
}

test("CMS combines text search with published and scheduled filters using the same count boundary", async () => {
  for (const status of ["published", "scheduled"]) {
    const { list, calls } = setup()
    await list({ status, search: "  training  ", page: 2 })
    assert.equal(calls.list.where.blogPublished, true)
    assert.ok(calls.list.where.createdAt[status === "published" ? "lte" : "gt"] instanceof Date)
    assert.deepEqual(calls.count.where, calls.list.where)
    assert.equal(calls.list.where.OR[0].blogTitle.contains, "training")
    assert.deepEqual(calls.list.orderBy, [{ createdAt: "desc" }, { id: "desc" }])
    assert.equal(calls.list.skip, 20)
  }
})

test("CMS draft and all filters and pagination remain bounded", async () => {
  const { list, calls } = setup(1)
  const result = await list({ status: "draft", page: 99 })
  assert.deepEqual(calls.list.where, { blogPublished: false })
  assert.equal(result.page, 1)
  assert.equal(calls.list.skip, 0)
  await list({ status: "invalid" })
  assert.deepEqual(calls.list.where, {})
})

test("list image generation reuses existing jobs and preserves publication state", () => {
  const page = read("app/(internal)/internal/(admin)/blog/page.tsx")
  const control = read("components/BlogAutomationProgressControl.tsx")
  const automation = read("lib/blog-automation.ts")
  const image = automation.slice(automation.indexOf("export async function generateBlogImageForPost"))
  assert.match(page, /<BlogAutomationProgressControl pidBlog=\{post.pidBlog\} type="image" compact/)
  assert.match(page, /pageHref\(item, params.q, status\)/)
  assert.match(control, /if \(compact\) return;/) // no per-row progress requests on initial list load
  assert.match(control, /router.refresh\(\)/)
  assert.match(image, /revalidatePath\("\/blog"\)/)
  assert.doesNotMatch(image.slice(0, image.indexOf("return { jobUuid")), /blogPublished\s*:/)
})

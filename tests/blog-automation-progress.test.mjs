import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const workflow = await readFile(new URL("../lib/blog-automation.ts", import.meta.url), "utf8")
const nextConfig = await readFile(new URL("../next.config.ts", import.meta.url), "utf8")
const route = await readFile(new URL("../app/api/internal/blog/[pidBlog]/automation/route.ts", import.meta.url), "utf8")
const control = await readFile(new URL("../components/BlogAutomationProgressControl.tsx", import.meta.url), "utf8")

test("image and PDF generation report persistent server checkpoints", () => {
  assert.match(workflow, /tochukwu_blog_automation_jobs/)
  assert.match(workflow, /Generating the cover image with OpenAI/)
  assert.match(workflow, /Uploading the generated image to Cloudinary/)
  assert.match(workflow, /Generating lead magnet copy with OpenAI/)
  assert.match(workflow, /Applying the branded two-page PDF design/)
  assert.match(workflow, /Saving and activating the PDF offer/)
})

test("lead magnet PDFs use the branded two-page design renderer", () => {
  const renderer = workflow.slice(workflow.indexOf("async function createDesignedPdfBuffer"), workflow.indexOf("async function makeUniqueLeadMagnetSlug"))
  assert.match(nextConfig, /serverExternalPackages:\s*\["pdfkit"\]/)
  assert.match(workflow, /finished PDF is exactly two A4 pages/)
  assert.equal((renderer.match(/doc\.addPage\(\)/g) || []).length, 1)
  assert.match(workflow, /new PDFDocument\(\{[\s\S]*size: "A4"[\s\S]*bufferPages: true/)
  assert.match(workflow, /Author: "Tochukwu Nkwocha"/)
  assert.match(workflow, /public\/brand\/tochukwu-tech-logo-reverse\.png/)
  assert.match(workflow, /function pageChrome\(/)
  assert.match(workflow, /item\.pdf\.sections\.forEach/)
  assert.match(workflow, /link: ctaUrl/)
  assert.match(workflow, /renderedPageCount !== 2/)
  assert.match(workflow, /await createDesignedPdfBuffer\(generated, post\)/)
  assert.doesNotMatch(workflow, /createSimplePdfBuffer/)
})

test("PDF-only rebuilds reuse saved copy without calling OpenAI", () => {
  assert.match(workflow, /draft_json/)
  assert.match(workflow, /rebuildLeadMagnetPdfForPost/)
  assert.match(workflow, /openAiCalled: false/)
  assert.match(route, /leadMagnetLayout/)
  assert.match(control, /Rebuild PDF design — no OpenAI/)
  assert.match(control, /Saved copy loaded \(no OpenAI\)/)
})

test("automation starts once, runs after the response, and reconnects by job id", () => {
  assert.match(route, /after\(async \(\) =>/)
  assert.match(route, /alreadyRunning/)
  assert.match(route, /getBlogAutomationJob/)
  assert.match(control, /jobUuid/)
  assert.match(control, /Progress is saved on the server/)
  assert.match(control, /window\.setTimeout\(poll, 2500\)/)
})

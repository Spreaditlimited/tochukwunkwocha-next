import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const workflow = await readFile(new URL("../lib/blog-automation.ts", import.meta.url), "utf8")
const route = await readFile(new URL("../app/api/internal/blog/[pidBlog]/automation/route.ts", import.meta.url), "utf8")
const control = await readFile(new URL("../components/BlogAutomationProgressControl.tsx", import.meta.url), "utf8")

test("image and PDF generation report persistent server checkpoints", () => {
  assert.match(workflow, /tochukwu_blog_automation_jobs/)
  assert.match(workflow, /Generating the cover image with OpenAI/)
  assert.match(workflow, /Uploading the generated image to Cloudinary/)
  assert.match(workflow, /Generating lead magnet copy with OpenAI/)
  assert.match(workflow, /Building the PDF file/)
  assert.match(workflow, /Saving and activating the PDF offer/)
})

test("automation starts once, runs after the response, and reconnects by job id", () => {
  assert.match(route, /after\(async \(\) =>/)
  assert.match(route, /alreadyRunning/)
  assert.match(route, /getBlogAutomationJob/)
  assert.match(control, /jobUuid/)
  assert.match(control, /Progress is saved on the server/)
  assert.match(control, /window\.setTimeout\(poll, 2500\)/)
})

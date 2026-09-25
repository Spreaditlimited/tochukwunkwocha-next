import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import ts from "typescript"

const require = createRequire(import.meta.url)
// Run the real service/actions with explicit storage and framework doubles.
// No database connection, environment-file loading, or live writes occur here.
function load(file, mocks = {}) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const module = { exports: {} }
  new Function("require", "module", "exports", compiled)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name.startsWith("@/")) throw new Error(`Unexpected dependency: ${name}`)
    return require(name)
  }, module, module.exports)
  return module.exports
}
const validation = load("lib/ask-validation.ts")
const id = "11111111-1111-4111-8111-111111111111"
const version = new Date("2026-09-24T12:00:00Z")

test("text limits reject malformed submissions without silently truncating them", () => {
  for (const value of [null, {}, [], 123, "hi", "a".repeat(1501), "hello\u0000world"]) assert.throws(() => validation.askText(value))
  assert.equal(validation.askText("  First line\r\nSecond line  "), "First line\nSecond line")
  assert.equal(validation.askText("a".repeat(1500)).length, 1500)
})

test("Facebook destinations reject script, deceptive hosts, redirects and credentials", () => {
  for (const url of ["javascript:alert(1)", "http://facebook.com/post/1", "https://facebook.com.evil.example/posts/1", "https://evil.example/facebook.com/1", "https://user:password@facebook.com/posts/1", "https://facebook.com/l.php?u=https://evil.example", "https://facebook.com/sharer.php?u=x", "https://facebook.com/"]) assert.throws(() => validation.askFacebookUrl(url))
  assert.equal(validation.askFacebookUrl("https://www.facebook.com/profile/posts/123"), "https://www.facebook.com/profile/posts/123")
  assert.equal(validation.askFacebookUrl("https://www.facebook.com/permalink.php?story_fbid=123&id=456"), "https://www.facebook.com/permalink.php?story_fbid=123&id=456")
  assert.equal(validation.askFacebookUrl("https://fb.watch/abc123/"), "https://fb.watch/abc123/")
  assert.equal(validation.askFacebookUrl(""), null)
})

test("IDs, statuses and pagination are bounded", () => {
  assert.equal(validation.askId(id), id)
  for (const value of ["../secrets", {}, "123"]) assert.throws(() => validation.askId(value))
  assert.throws(() => validation.askStatus("public"))
  for (const value of [undefined, "-1", "Infinity", "1.5"]) assert.equal(validation.askPage(value), 1)
  assert.equal(validation.askPage("200000"), 10000)
})

function service(prisma) {
  return load("lib/ask.ts", { "@/lib/prisma": { prisma }, "@/lib/ask-validation": validation })
}

test("visitor submissions publish with visibility off and without identity or answer permissions", async () => {
  let saved
  const api = service({ askQuestion: { create: async ({ data }) => { saved = data } } })
  await api.submitAsk({ body: "A private visitor question?" })
  assert.equal(saved.status, "unlisted")
  assert.equal(saved.kind, "visitor")
  assert.equal(saved.acceptingAnswers, false)
  assert.deepEqual(Object.keys(saved).sort(), ["acceptingAnswers", "body", "id", "kind", "publishedAt", "status"])
})

test("responses require an open published prompt under a transaction lock", async () => {
  let open = false
  let saved
  const prisma = {
    $transaction: async (fn) => fn(prisma),
    $queryRaw: async (sql, questionId) => {
      assert.equal(questionId, id)
      assert.match(sql.join("?"), /kind = 'prompt'.*status IN \('published', 'unlisted'\).*accepting_answers = true/s)
      assert.match(sql.join("?"), /FOR UPDATE/)
      return open ? [{ id }] : []
    },
    askAnswer: { create: async ({ data }) => { saved = data } }
  }
  const api = service(prisma)
  await assert.rejects(api.submitAsk({ body: "An anonymous perspective", questionId: id }), /no longer accepting/)
  assert.equal(saved, undefined)
  open = true
  await api.submitAsk({ body: "An anonymous perspective", questionId: id })
  assert.equal(saved.status, "pending")
  assert.equal(saved.questionId, id)
})

test("public reads filter both parent and responses and select no private fields", async () => {
  const api = service({ askQuestion: {
    findMany: async (query) => { assert.equal(query.where.status, "published"); assert.equal(query.take, 13); assert.equal(query.skip, 12); return [] },
    findFirst: async (query) => {
      assert.deepEqual(query.where, { id, status: "published" })
      assert.equal(query.select.answers.where.status, "published")
      assert.deepEqual(query.select.answers.select, { id: true, body: true })
      assert.equal(query.select._count.select.answers.where.status, "published")
      assert.equal(query.select.status, undefined)
      return null
    }
  } })
  await api.listPublicQuestions(2)
  assert.equal(await api.getPublicQuestion(id, 1), null)
})

test("lightweight answer links expose only published audience prompts without loading responses", async () => {
  assert.equal(validation.askAnswerPath(id), `/ask/${id}/answer`)
  assert.throws(() => validation.askAnswerPath("../private"))
  const api = service({ askQuestion: {
    findFirst: async (query) => {
      assert.deepEqual(query.where, { id, kind: "prompt", status: { in: ["published", "unlisted"] } })
      assert.deepEqual(query.select, { id: true, body: true, acceptingAnswers: true })
      return { id, body: "What would you like to learn?", acceptingAnswers: false }
    }
  } })
  assert.equal((await api.getAnswerPrompt(id)).acceptingAnswers, false)
})

test("persistent rate counters separate identity from content and expire", async () => {
  const previous = process.env.DATABASE_URL
  process.env.DATABASE_URL = "test-only-secret"
  const keys = []
  let count = 0
  try {
    const api = service({ askRateLimit: {
      upsert: async (query) => { keys.push(query.where.key); assert.equal(query.update.count.increment, 1); assert.equal(query.create.expiresAt.toISOString(), "2026-09-24T13:00:00.000Z"); return { count: ++count } },
      deleteMany: async (query) => assert.ok(query.where.expiresAt.lte instanceof Date)
    } })
    for (let attempt = 1; attempt <= 6; attempt++) {
      const result = await api.consumeAskRateLimit("192.0.2.1", version)
      assert.equal(result.allowed, attempt <= 5)
      assert.equal(result.retryAfter, 3600)
    }
    assert.equal(new Set(keys).size, 1)
    assert.match(keys[0], /^[a-f0-9]{64}$/)
    assert.ok(!keys[0].includes("192.0.2.1"))
  } finally { if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous }
})

function route({ save = async () => {}, captcha = true, enabled = true, limited = false } = {}) {
  return load("app/api/ask/route.ts", {
    "@/lib/ask-validation": validation,
    "@/lib/ask": { submitAsk: save, consumeAskRateLimit: async () => ({ allowed: !limited, retryAfter: 30 }) },
    "@/lib/recaptcha": { clientIpFromRequest: () => "test", recaptchaEnabled: () => enabled, verifyRecaptchaToken: async () => ({ ok: captcha }) }
  })
}
function request(body, headers = {}) {
  return new Request("https://example.test/api/ask", { method: "POST", headers: { "content-type": "application/json", origin: "https://example.test", ...headers }, body: JSON.stringify(body) })
}

test("API rejects cross-origin, invalid, oversized, CAPTCHA-failed and rate-limited submissions", async () => {
  const fail = async () => assert.fail("Rejected input reached storage")
  assert.equal((await route({ save: fail }).POST(request({ body: "Question?" }, { origin: "https://other.test" }))).status, 403)
  for (const body of [null, [], { body: "hi" }, { body: "Question?", questionId: "invalid" }, { body: "a".repeat(17000) }]) assert.equal((await route({ save: fail }).POST(request(body))).status, 400)
  assert.equal((await route({ save: fail, captcha: false }).POST(request({ body: "Question?" }))).status, 400)
  const limited = await route({ save: fail, limited: true }).POST(request({ body: "Question?" }))
  assert.equal(limited.status, 429)
  assert.equal(limited.headers.get("retry-after"), "30")
})

test("API ignores bot submissions, conceals storage errors, and returns no private IDs", async () => {
  const bot = await route({ save: async () => assert.fail("Honeypot saved") }).POST(request({ website: "spam" }))
  assert.equal(bot.status, 200)
  const failed = await route({ save: async () => { throw new Error("secret db details") } }).POST(request({ body: "Question?" }))
  assert.equal(failed.status, 503)
  assert.doesNotMatch(await failed.text(), /secret db details/)
  let saved
  const response = await route({ save: async (value) => { saved = value } }).POST(request({ body: "Question?", email: "ignore@example.test", status: "published" }))
  assert.equal(response.status, 201)
  assert.deepEqual(saved, { body: "Question?", questionId: undefined })
  assert.deepEqual(Object.keys(await response.json()).sort(), ["message", "ok"])
  const proxied = new Request("http://localhost:3107/api/ask", { method: "POST", headers: { "content-type": "application/json", origin: "http://127.0.0.1:3107", host: "127.0.0.1:3107" }, body: JSON.stringify({ body: "A question through the local proxy?" }) })
  assert.equal((await route().POST(proxied)).status, 201)
})

test("production submissions fail closed when CAPTCHA is unavailable", async () => {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = "production"
  try {
    const response = await route({ enabled: false, save: async () => assert.fail("Saved without production CAPTCHA") }).POST(request({ body: "A valid question?" }))
    assert.equal(response.status, 503)
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous }
})

function actions(prisma, auth = async (path) => assert.equal(path, "/internal/questions")) {
  return load("app/(internal)/internal/(admin)/questions/actions.ts", {
    "@/lib/auth": { requireAdmin: auth }, "@/lib/prisma": { prisma },
    "@/lib/ask-validation": validation, "next/cache": { revalidatePath: () => {} }
  })
}
function form(fields) { const form = new FormData(); for (const [key, value] of Object.entries(fields)) form.set(key, value); return form }

test("standalone question page renders a compact anonymous form without database access", () => {
  const { createElement } = require("react")
  const { renderToStaticMarkup } = require("react-dom/server")
  const { AskForm } = load("components/ask/AskForm.tsx", {
    "lucide-react": { ArrowUpRight: () => null, Loader2: () => null, Send: () => null },
    "@/lib/browser-recaptcha": { getRecaptchaToken: () => { throw new Error("Must not request CAPTCHA during render") } },
    "@/components/RecaptchaDisclosure": { RecaptchaDisclosure: () => null },
    "@/lib/ask-validation": validation,
    "next/link": { default: ({ children, ...props }) => createElement("a", props, children) }
  })
  const page = load("app/(answer)/ask/question/page.tsx", {
    "@/components/ask/AskForm": { AskForm },
    "@/lib/site-seo": { buildMetadata: (input) => input }
  })
  assert.equal(page.metadata.path, "/ask/question")
  assert.equal(page.metadata.noIndex, true)
  const html = renderToStaticMarkup(createElement(page.default))
  assert.match(html, /<textarea/)
  assert.match(html, /Send anonymous question/)
  assert.match(html, /Your question comes to Tochukwu privately/)
  assert.doesNotMatch(html, /Send anonymous answer|<nav|<footer|type="email"/)
})

test("all moderation actions authorize before touching data", async () => {
  const api = actions({}, async () => { throw new Error("forbidden") })
  await assert.rejects(api.saveQuestionAction({}, form({})), /forbidden/)
  await assert.rejects(api.moderateAnswerAction({}, form({})), /forbidden/)
  await assert.rejects(api.unpublishQuestionAction({}, form({})), /forbidden/)
  await assert.rejects(api.deleteQuestionAction({}, form({})), /forbidden/)
  await assert.rejects(api.setQuestionVisibilityAction({}, form({})), /forbidden/)
  await assert.rejects(api.publishQuestionAction({}, form({})), /forbidden/)
})

test("question deletion allows private statuses and atomically rejects published or stale questions", async () => {
  let currentStatus = "published"
  let exists = true
  const api = actions({ askQuestion: { deleteMany: async ({ where }) => {
    assert.deepEqual(where.status.in, ["draft", "pending", "archived"])
    assert.equal(where.id, id)
    const allowed = exists && where.status.in.includes(currentStatus) && where.updatedAt.getTime() === version.getTime()
    if (allowed) exists = false
    return { count: allowed ? 1 : 0 }
  } } })
  const fields = { id, version: version.toISOString() }
  assert.match((await api.deleteQuestionAction({}, form(fields))).error, /unpublished first/)
  assert.equal(exists, true)
  currentStatus = "unlisted"
  assert.match((await api.deleteQuestionAction({}, form(fields))).error, /unpublished first/)
  assert.equal(exists, true)
  currentStatus = "draft"
  assert.ok((await api.deleteQuestionAction({}, form({ ...fields, version: "2026-09-23T12:00:00Z" }))).error)
  assert.equal(exists, true)
  for (const status of ["draft", "pending", "archived"]) {
    exists = true
    currentStatus = status
    assert.match((await api.deleteQuestionAction({}, form(fields))).message, /permanently deleted/)
    assert.equal(exists, false)
    assert.ok((await api.deleteQuestionAction({}, form(fields))).error)
  }
})

test("question deletion validates inputs before writing and hides database errors", async () => {
  let writes = 0
  const api = actions({ askQuestion: { deleteMany: async () => {
    writes++
    throw new Error("private database details")
  } } })
  assert.ok((await api.deleteQuestionAction({}, form({ id: "invalid", version: version.toISOString() }))).error)
  assert.match((await api.deleteQuestionAction({}, form({ id, version: "invalid" }))).error, /Refresh/)
  assert.equal(writes, 0)
  assert.equal((await api.deleteQuestionAction({}, form({ id, version: version.toISOString() }))).error, "Could not delete this question. Please try again.")
  assert.equal(writes, 1)
})

test("one-click unpublish changes visibility only and rejects stale or invalid versions", async () => {
  let writes = 0
  let affected = 1
  const api = actions({ askQuestion: { updateMany: async (query) => {
    writes++
    assert.deepEqual(query.where, { id, status: { in: ["published", "unlisted"] }, updatedAt: version })
    assert.deepEqual(query.data, { status: "draft", publishedAt: null })
    return { count: affected }
  } } })
  const fields = { id, version: version.toISOString() }
  assert.match((await api.unpublishQuestionAction({}, form(fields))).message, /Question unpublished/)
  affected = 0
  assert.match((await api.unpublishQuestionAction({}, form(fields))).error, /changed or is already unpublished/)
  assert.equal(writes, 2)
  assert.match((await api.unpublishQuestionAction({}, form({ ...fields, version: "invalid" }))).error, /Refresh/)
  assert.equal(writes, 2)
})

test("question moderation preserves anonymous text, supports unpublish, rejects stale edits", async () => {
  let saved
  const prisma = {
    $transaction: async (fn) => fn(prisma), $queryRaw: async () => [{ id }],
    askQuestion: {
      findUniqueOrThrow: async () => ({ id, kind: "visitor", body: "Original private question", updatedAt: version, publishedAt: version }),
      update: async ({ data }) => { saved = data }
    }
  }
  const api = actions(prisma)
  const fields = { id, status: "draft", version: version.toISOString(), body: "Tampered content", acceptingAnswers: "on" }
  assert.ok((await api.saveQuestionAction({}, form(fields))).message)
  assert.equal(saved.body, "Original private question")
  assert.equal(saved.acceptingAnswers, false)
  assert.equal(saved.publishedAt, null)
  assert.match((await api.saveQuestionAction({}, form({ ...fields, version: "stale" }))).error, /another tab/)
})

test("answers can be approved under published or unlisted questions, but not drafts", async () => {
  let parentStatus = "draft"
  let updated = false
  const prisma = {
    $transaction: async (fn) => fn(prisma),
    $queryRaw: async () => [{ status: parentStatus, kind: "prompt" }],
    askAnswer: {
      findUnique: async () => ({ id, questionId: id }),
      updateMany: async () => { updated = true; return { count: 1 } }
    }
  }
  const api = actions(prisma)
  const fields = { id, version: version.toISOString(), status: "published" }
  assert.match((await api.moderateAnswerAction({}, form(fields))).error, /Publish the audience question/)
  assert.equal(updated, false)
  parentStatus = "published"
  assert.ok((await api.moderateAnswerAction({}, form(fields))).message)
  parentStatus = "unlisted"
  assert.ok((await api.moderateAnswerAction({}, form(fields))).message)
  parentStatus = "archived"
  assert.ok((await api.moderateAnswerAction({}, form({ ...fields, status: "archived" }))).message)
})

test("questions can publish hidden without Facebook and become public only by explicit status change", async () => {
  let saved
  const prisma = {
    $transaction: async (fn) => fn(prisma),
    $queryRaw: async () => [{ id }],
    askQuestion: {
      create: async ({ data }) => { saved = { ...data, updatedAt: version } },
      findUniqueOrThrow: async () => saved,
      update: async ({ data }) => { saved = { ...saved, ...data } }
    }
  }
  const api = actions(prisma)
  const fields = { body: "What would you like to learn?", status: "unlisted", facebookUrl: "", acceptingAnswers: "on" }
  const result = await api.saveQuestionAction({}, form(fields))
  assert.match(result.message, /Published but hidden/)
  assert.equal(saved.status, "unlisted")
  assert.equal(saved.facebookUrl, null)
  assert.equal(saved.acceptingAnswers, true)
  assert.ok(saved.publishedAt instanceof Date)
  const update = { ...fields, id: result.createdId, version: version.toISOString(), facebookUrl: "https://www.facebook.com/example/posts/123" }
  assert.ok((await api.saveQuestionAction({}, form(update))).message)
  assert.equal(saved.status, "unlisted")
  assert.equal(saved.facebookUrl, update.facebookUrl)
  assert.ok((await api.saveQuestionAction({}, form({ ...update, status: "published" }))).message)
  assert.equal(saved.status, "published")
})

test("new questions always publish with visibility off even if submitted as public", async () => {
  assert.equal(validation.askQuestionStatus("unlisted"), "unlisted")
  assert.throws(() => validation.askStatus("unlisted"))
  let saved
  const prisma = {
    $transaction: async (fn) => fn(prisma),
    askQuestion: { create: async ({ data }) => { saved = data } }
  }
  assert.ok((await actions(prisma).saveQuestionAction({}, form({ body: "A public question without a link?", status: "published" }))).message)
  assert.equal(saved.status, "unlisted")
  assert.equal(saved.facebookUrl, null)
})

test("visibility toggle switches independently of Facebook links and rejects stale or invalid input", async () => {
  let saved
  let writes = 0
  let count = 1
  const api = actions({ askQuestion: { updateMany: async ({ where, data }) => {
    writes++
    assert.deepEqual(where, { id, updatedAt: version, status: { in: ["published", "unlisted"] } })
    assert.deepEqual(Object.keys(data).sort(), ["publishedAt", "status"])
    saved = data
    return { count }
  } } })
  const fields = { id, version: version.toISOString(), visible: "true" }
  assert.ok((await api.setQuestionVisibilityAction({}, form(fields))).message)
  assert.equal(saved.status, "published")
  assert.ok((await api.setQuestionVisibilityAction({}, form({ ...fields, visible: "false" }))).message)
  assert.equal(saved.status, "unlisted")
  count = 0
  assert.match((await api.setQuestionVisibilityAction({}, form(fields))).error, /changed/)
  const before = writes
  assert.ok((await api.setQuestionVisibilityAction({}, form({ ...fields, visible: "bad" }))).error)
  assert.ok((await api.setQuestionVisibilityAction({}, form({ ...fields, version: "bad" }))).error)
  assert.equal(writes, before)
})

test("publish and republish activate the same answer link independently of public visibility", async () => {
  let question = { id, kind: "prompt", body: "What do you think?", status: "draft", acceptingAnswers: false, facebookUrl: null, updatedAt: version }
  const answers = []
  const matches = (where) => Object.entries(where).every(([key, value]) => {
    if (value instanceof Date) return question[key].getTime() === value.getTime()
    return typeof value === "object" ? value.in.includes(question[key]) : question[key] === value
  })
  const prisma = {
    $transaction: async (fn) => fn(prisma),
    $queryRaw: async (sql) => sql.join("").includes("accepting_answers")
      ? (validation.isQuestionPublished(question.status) && question.acceptingAnswers ? [{ id }] : [])
      : [{ id }],
    askQuestion: {
      findUniqueOrThrow: async () => question,
      findFirst: async ({ where }) => matches(where) ? question : null,
      findMany: async ({ where }) => matches(where) ? [question] : [],
      update: async ({ data }) => { question = { ...question, ...data } },
      updateMany: async ({ where, data }) => {
        if (!matches(where)) return { count: 0 }
        question = { ...question, ...data }
        return { count: 1 }
      }
    },
    askAnswer: { create: async ({ data }) => answers.push(data) }
  }
  const admin = actions(prisma)
  const publicApi = service(prisma)
  const fields = { id, version: version.toISOString() }
  assert.ok((await admin.publishQuestionAction({}, form(fields))).message)
  assert.equal(question.status, "unlisted")
  assert.equal(question.acceptingAnswers, true)
  const link = validation.askAnswerPath(id)
  for (const visible of ["false", "true", "false"]) {
    assert.ok((await admin.setQuestionVisibilityAction({}, form({ ...fields, visible }))).message)
    assert.equal(question.facebookUrl, null)
    assert.equal((await publicApi.listPublicQuestions(1)).length, visible === "true" ? 1 : 0)
    assert.equal(Boolean(await publicApi.getPublicQuestion(id, 1)), visible === "true")
    assert.equal((await publicApi.getAnswerPrompt(id)).id, id)
    assert.equal(validation.askAnswerPath(id), link)
    await publicApi.submitAsk({ questionId: id, body: "My anonymous answer" })
  }
  assert.equal(answers.length, 3)
  assert.ok(answers.every((answer) => answer.status === "pending"))
  assert.ok((await admin.unpublishQuestionAction({}, form(fields))).message)
  assert.equal(await publicApi.getAnswerPrompt(id), null)
  assert.ok((await admin.setQuestionVisibilityAction({}, form({ ...fields, visible: "true" }))).error)
  assert.ok((await admin.publishQuestionAction({}, form(fields))).message)
  assert.equal(question.status, "unlisted")
  await publicApi.submitAsk({ questionId: id, body: "An answer after republishing" })
  assert.equal(answers.length, 4)
  assert.ok((await admin.publishQuestionAction({}, form(fields))).error)
  assert.ok((await admin.publishQuestionAction({}, form({ ...fields, version: "stale" }))).error)
})

import assert from "node:assert/strict"
import test from "node:test"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import ts from "typescript"

const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, "..")
function load(file, overrides = {}, cache = new Map()) {
  if (Object.hasOwn(overrides, file)) return overrides[file]
  if (cache.has(file)) return cache.get(file).exports
  if (file === "lib/prisma") throw new Error("Tests must never connect to a database")
  const source = fs.readFileSync(path.join(root, `${file}.ts`), "utf8")
  const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true}}).outputText
  const mod = {exports: {}}
  cache.set(file, mod)
  new Function("require", "module", "exports", compiled)(name => name.startsWith("@/") ? load(name.slice(2), overrides, cache) : require(name), mod, mod.exports)
  return mod.exports
}
const policy = load("lib/self-paced-cohorts")
const {selfPacedContentReady} = load("lib/self-paced-availability", {"lib/prisma": {prisma: {}}})
const module = {moduleId: 1n, dripEnabled: 1, dripAt: null, dripBatchKey: null, dripOffsetSeconds: null, hasSchedules: 1, accessMode: "drip", batchDripAt: new Date("2026-09-25T06:00:00Z"), lessons: 38, unavailableVideos: 0}
const ready = {sourceBatchKey: "ptp-batch-4", batchStartAt: new Date("2026-09-21T19:00:00Z"), batchEndAt: null, lastLiveSessionAt: null, releaseAt: null, published: true, completedAfter: "2026-09-26T00:00:00+01:00", minimumLessons: 38, modules: [module], nowMs: Date.parse("2026-11-05T12:00:00Z")}

test("instant access is restricted to the correct course and explicitly selected completed cohort", () => {
  assert.equal(policy.isSelfPacedCohort("prompt-to-profit", "ptp-batch-4-self-paced"), true)
  assert.equal(policy.isSelfPacedCohort("prompt-to-production", "ptp-batch-4-self-paced"), false)
  assert.equal(policy.isSelfPacedCohort("prompt-to-profit", "ptp-batch-4"), false)
  assert.equal(policy.curriculumBatchKey("prompt-to-production", "ptpprod-batch-2-self-paced"), "ptpprod-batch-2")
})

test("only complete, published, released recordings may be advertised", () => {
  assert.equal(selfPacedContentReady(ready), true)
  for (const change of [
    {published: false}, {modules: []}, {modules: [{...module, lessons: 37}]},
    {modules: [{...module, unavailableVideos: 1}]}, {modules: [{...module, batchDripAt: null}]},
    {modules: [{...module, batchDripAt: new Date("2027-01-01Z")}]},
    {lastLiveSessionAt: new Date("2027-01-01Z")}, {batchEndAt: new Date("2027-01-01Z")},
    {completedAfter: "2027-01-01T00:00:00Z"}, {releaseAt: new Date("2027-01-01Z")}
  ]) assert.equal(selfPacedContentReady({...ready, ...change}), false)
  assert.equal(selfPacedContentReady({...ready, modules: [module, {...module, moduleId: 2n, accessMode: null, unavailableVideos: 1}]}), true, "Other cohorts' recordings are excluded")
})

test("checkout describes confirmation, manual approval and installment completion distinctly", () => {
  assert.match(policy.selfPacedPaymentMessage("paystack"), /payment is confirmed/)
  assert.match(policy.selfPacedPaymentMessage("manual_transfer"), /transfer is approved/)
  assert.match(policy.selfPacedPaymentMessage("installment"), /fully paid/)
})

test("welcome email contains immediate access and public links; scheduled welcome stays unchanged", async () => {
  const sent = []
  const notifications = load("lib/enrollment-notifications", {
    "lib/prisma": {prisma: {}}, "lib/admin-settings": {applyAdminSettingsToProcessEnv: async () => {}},
    "lib/email": {sendEmail: async message => {sent.push(message); return {ok: true}}}
  })
  await notifications.sendStudentAccountReadyEmail({email: "test@example.com", fullName: "Test Learner", courseSlug: "prompt-to-profit", batchKey: "ptp-batch-4-self-paced", batchLabel: "September recordings", temporaryPassword: "test-only-password"})
  assert.equal(sent.length, 1)
  assert.match(sent[0].subject, /lessons are ready/)
  assert.match(sent[0].text, /one full year/)
  assert.match(sent[0].text, /no daily lesson emails or automated learning reminders/)
  assert.match(sent[0].text, /dashboard\/courses\/player\?course=prompt-to-profit/)
  assert.doesNotMatch(sent[0].text + sent[0].html, /localhost|127\.0\.0\.1|\.local\//)
  assert.equal((await notifications.syncEnrollmentToBrevo({email: "test@example.com", courseSlug: "prompt-to-profit", batchKey: "ptp-batch-4-self-paced", source: "test"})).reason, "self_paced_enrollment")
  await notifications.sendStudentAccountReadyEmail({email: "test@example.com", courseSlug: "prompt-to-profit", batchKey: "future-live"})
  assert.equal(sent[1].subject, "IMPORTANT: Your course access is ready — keep this email")
  assert.match(sent[1].text, /when lessons are available/)
})

test("the existing access gate applies the standard one-year calculation only to instant-access enrollments", async () => {
  let grants = []
  const player = load("lib/learning-player", {
    "lib/prisma": {prisma: {$queryRaw: async () => grants}},
    "lib/school-course-access": {hasActiveSchoolCourseAccess: async () => false},
    "lib/email": {}, "lib/admin-settings": {}
  })
  const {addOneYear} = load("lib/utils")
  const originalNow = Date.now
  const start = new Date("2026-11-05T12:00:00Z")
  const expiry = addOneYear(start).getTime()
  grants = [{batchKey: "ptp-batch-4-self-paced", grantedAt: start, explicitExpiry: null, isOverride: 0}]
  try {
    Date.now = () => expiry - 1
    assert.equal(await player.studentHasCourseAccess(1n, "test@example.com", "prompt-to-profit"), true)
    Date.now = () => expiry
    assert.equal(await player.studentHasCourseAccess(1n, "test@example.com", "prompt-to-profit"), false)
    grants = [{...grants[0], batchKey: "ptp-batch-4"}]
    assert.equal(await player.studentHasCourseAccess(1n, "test@example.com", "prompt-to-profit"), true, "Existing live policy stays unchanged")
    grants = []
    assert.equal(await player.studentHasCourseAccess(1n, "test@example.com", "prompt-to-profit"), false)
  } finally {Date.now = originalNow}
})

test("signed video URLs cannot outlive the same enrollment expiry", () => {
  const {privateKey} = crypto.generateKeyPairSync("rsa", {modulusLength: 2048})
  const values = {CLOUDFLARE_STREAM_SIGNING_KEY_ID: "local-test-key", CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY: privateKey.export({type: "pkcs8", format: "pem"}).toString()}
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]))
  Object.assign(process.env, values)
  try {
    const playback = load("lib/learning-playback", {"lib/admin-settings": {}})
    const accessExpiresAt = new Date(Date.now() + 45_000)
    const result = playback.buildSignedLessonEmbedUrl({videoUid: "test-video", accessExpiresAt})
    assert.ok(Date.parse(result.expiresAt) <= accessExpiresAt.getTime())
    assert.ok(result.ttlSeconds <= 45)
    assert.throws(() => playback.buildSignedLessonEmbedUrl({videoUid: "test-video", accessExpiresAt: new Date(Date.now()-1000)}), /expired/)
  } finally {for(const key of Object.keys(values)) {if(previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]}}
})

test("included workbooks expire with the same instant-access enrollment", async () => {
  const grantedAt = new Date("2026-11-05T12:00:00Z")
  let rows = [{courseSlug: "prompt-to-profit", batchKey: "ptp-batch-4-self-paced", grantedAt, batchStartAt: new Date("2026-09-21T19:00:00Z")}]
  const workbooks = load("lib/course-workbooks", {"lib/prisma": {prisma: {$queryRaw: async () => rows}}})
  const {addOneYear} = load("lib/utils")
  const expiresAt = addOneYear(grantedAt)
  const originalNow = Date.now
  try {
    Date.now = () => expiresAt.getTime() - 1
    const access = await workbooks.getPromptToProfitWorkbookAccess({accountId: 1n, email: "test@example.com"})
    assert.equal(access.enrolled, true)
    assert.equal(access.batchStarted, true)
    assert.deepEqual(access.accessExpiresAt, expiresAt)
    Date.now = () => expiresAt.getTime()
    assert.equal(await workbooks.hasIncludedPromptToProfitWorkbooks({accountId: 1n, email: "test@example.com"}), false)
    rows = [{...rows[0], batchKey: "ptp-batch-4"}]
    assert.equal(await workbooks.hasIncludedPromptToProfitWorkbooks({accountId: 1n, email: "test@example.com"}), true)
  } finally { Date.now = originalNow }
})

test("normal notification outbox suppresses automation even when enrollment callers request it", async () => {
  const originalSecret = process.env.NOTIFICATION_OUTBOX_SECRET
  process.env.NOTIFICATION_OUTBOX_SECRET = "local-test-only"
  const writes = []
  const outbox = load("lib/payment-notification-outbox", {
    "lib/prisma": {prisma: {$executeRaw: async (...args) => {writes.push(args); return 1}}},
    "lib/schema-guards": {addColumnIfMissing: async () => {}},
    "lib/enrollment-notifications": {}, "lib/transactional-whatsapp": {}
  })
  const input = {sourceType: "course_order", sourceUuid: "local-order", courseSlug: "prompt-to-profit", batchKey: "ptp-batch-4-self-paced", email: "test@example.com", syncBrevo: true, sendWhatsApp: true}
  try {
    const eventUuid = await outbox.enqueueEnrollmentConfirmationNotification(input)
    assert.equal(await outbox.enqueueEnrollmentConfirmationNotification(input), eventUuid, "Duplicate callbacks use the same delivery identity")
    const [iv, tag, encrypted] = writes[0][3].split(".").map(value => Buffer.from(value, "base64url"))
    const key = crypto.createHash("sha256").update(process.env.NOTIFICATION_OUTBOX_SECRET).digest()
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(tag)
    const payload = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString())
    assert.equal(payload.syncBrevo, false)
    assert.equal(payload.sendWhatsApp, false)
    assert.equal(payload.sendEmail, undefined, "The normal welcome email remains enabled by default")
  } finally {
    if (originalSecret === undefined) delete process.env.NOTIFICATION_OUTBOX_SECRET
    else process.env.NOTIFICATION_OUTBOX_SECRET = originalSecret
  }
})

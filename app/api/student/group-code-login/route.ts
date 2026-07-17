import crypto from "crypto"
import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { createStudentSessionForAccount, setStudentSessionCookie } from "@/lib/student-auth"

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max)
}

function normalizeCode(value: unknown) {
  return clean(value, 20).toUpperCase().replace(/[^A-Z0-9]/g, "")
}

function sha(input: unknown) {
  return crypto.createHash("sha256").update(String(input || "")).digest("hex")
}

function normalizeName(name: unknown) {
  return clean(name, 180).toLowerCase().replace(/\s+/g, " ").trim()
}

function maskName(name: unknown) {
  const parts = clean(name, 180).split(/\s+/).filter(Boolean)
  if (!parts.length) return "Student"
  return parts.map((part) => (part.length <= 1 ? "*" : `${part.charAt(0)}***`)).join(" ")
}

function signingSecret() {
  const secret = String(process.env.FAMILY_CHILD_LOGIN_SECRET || process.env.AUTH_SECRET || "").trim()
  if (secret) return secret
  if (process.env.NODE_ENV === "production") throw new Error("Group learner authentication is not configured.")
  return "local-development-family-child-login-secret"
}

function signChallenge(payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const sig = crypto.createHmac("sha256", signingSecret()).update(body).digest("base64url")
  return `${body}.${sig}`
}

function verifyChallenge(token: unknown) {
  const parts = String(token || "").split(".")
  if (parts.length !== 2) return null
  const expected = crypto.createHmac("sha256", signingSecret()).update(parts[0]).digest("base64url")
  const providedBuffer = Buffer.from(parts[1])
  const expectedBuffer = Buffer.from(expected)
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) return null
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as Record<string, unknown>
    if (Number(payload.exp || 0) < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

async function ensureAttemptsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS family_child_code_auth_attempts (
      id BIGINT NOT NULL AUTO_INCREMENT,
      code_hash VARCHAR(128) NOT NULL,
      ip_hash VARCHAR(128) NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      locked_until DATETIME NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_code_ip (code_hash, ip_hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

function ipFromRequest(request: Request) {
  const forwarded = clean(request.headers.get("x-forwarded-for"), 180)
  return clean(forwarded.split(",")[0] || request.headers.get("x-real-ip") || "na", 90)
}

async function getAttempt(codeHash: string, ipHash: string) {
  const rows = await prisma.$queryRaw<Array<{ id: bigint; attempts: number | bigint | null; locked_until: Date | null }>>`
    SELECT id, attempts, locked_until
    FROM family_child_code_auth_attempts
    WHERE code_hash = ${codeHash}
      AND ip_hash = ${ipHash}
    LIMIT 1
  `
  return rows[0] || null
}

async function recordFailure(codeHash: string, ipHash: string) {
  const current = await getAttempt(codeHash, ipHash)
  const nextAttempts = Number(current?.attempts || 0) + 1
  const lockUntil = nextAttempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null
  if (current?.id) {
    await prisma.$executeRaw`
      UPDATE family_child_code_auth_attempts
      SET attempts = ${nextAttempts}, locked_until = ${lockUntil}, updated_at = ${new Date()}
      WHERE id = ${current.id}
      LIMIT 1
    `
    return
  }
  await prisma.$executeRaw`
    INSERT INTO family_child_code_auth_attempts
      (code_hash, ip_hash, attempts, locked_until, updated_at)
    VALUES
      (${codeHash}, ${ipHash}, ${nextAttempts}, ${lockUntil}, ${new Date()})
  `
}

async function clearAttempts(codeHash: string, ipHash: string) {
  await prisma.$executeRaw`
    DELETE FROM family_child_code_auth_attempts
    WHERE code_hash = ${codeHash}
      AND ip_hash = ${ipHash}
  `
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })

  const code = normalizeCode(body.code)
  if (code.length < 8) return NextResponse.json({ ok: false, error: "Enter a valid group learner code." }, { status: 400 })

  try {
    await ensureAttemptsTable()
    const codeHash = sha(code)
    const ipHash = sha(ipFromRequest(request))
    const attempt = await getAttempt(codeHash, ipHash)
    if (attempt?.locked_until && attempt.locked_until.getTime() > Date.now()) {
      return NextResponse.json({ ok: false, error: "Too many attempts. Try again in a few minutes." }, { status: 429 })
    }

    const rows = await prisma.$queryRaw<
      Array<{
        id: bigint
        account_id: bigint | null
        full_name: string | null
        parent_name: string | null
        source_type?: string | null
      }>
    >`
      SELECT c.id, c.account_id, c.full_name, f.parent_name, 'family' AS source_type
      FROM family_children c
      JOIN family_accounts f ON f.id = c.family_id
      JOIN family_child_enrollments e ON e.child_id = c.id
      WHERE c.access_code = ${code}
        AND c.status = 'active'
        AND f.status = 'active'
        AND e.status = 'active'
      ORDER BY c.id DESC
      LIMIT 1
    `
    let learner = rows[0]
    if (!learner?.account_id) {
      const schoolRows = await prisma.$queryRaw<
        Array<{
          id: bigint
          account_id: bigint | null
          full_name: string | null
          parent_name: string | null
          source_type: string
        }>
      >`
        SELECT ss.id, ss.account_id, ss.full_name, sc.school_name AS parent_name, 'school' AS source_type
        FROM school_students ss
        JOIN school_accounts sc ON sc.id = ss.school_id
        WHERE ss.student_code = ${code}
          AND ss.status = 'active'
          AND sc.status = 'active'
          AND (sc.access_starts_at IS NULL OR sc.access_starts_at <= NOW())
          AND (sc.access_expires_at IS NULL OR sc.access_expires_at >= NOW())
        ORDER BY ss.id DESC
        LIMIT 1
      `.catch(() => [])
      learner = schoolRows[0]
    }
    if (!learner?.account_id) {
      await recordFailure(codeHash, ipHash)
      return NextResponse.json({ ok: false, error: "Invalid group learner code." }, { status: 401 })
    }

    if (!body.confirm) {
      const sourceType = clean(learner.source_type, 40) === "school" ? "school" : "family"
      return NextResponse.json({
        ok: true,
        needsConfirm: true,
        student: {
          familyName: clean(learner.parent_name, 180),
          maskedName: maskName(learner.full_name),
          sourceType
        },
        challenge: signChallenge({
          childId: learner.id.toString(),
          accountId: learner.account_id.toString(),
          sourceType,
          codeHash,
          exp: Date.now() + 5 * 60 * 1000
        })
      })
    }

    const payload = verifyChallenge(body.challenge)
    if (!payload || String(payload.childId || "") !== learner.id.toString() || String(payload.codeHash || "") !== codeHash) {
      await recordFailure(codeHash, ipHash)
      return NextResponse.json({ ok: false, error: "Confirmation expired. Enter the code again." }, { status: 401 })
    }
    if (normalizeName(body.confirmName) !== normalizeName(learner.full_name)) {
      await recordFailure(codeHash, ipHash)
      return NextResponse.json({ ok: false, error: "Name does not match this learner code." }, { status: 401 })
    }

    const account = await prisma.studentAccount.findUnique({ where: { id: learner.account_id } })
    if (!account) {
      await recordFailure(codeHash, ipHash)
      return NextResponse.json({ ok: false, error: "Learner account was not found." }, { status: 401 })
    }

    await clearAttempts(codeHash, ipHash)
    const session = await createStudentSessionForAccount(account)
    await setStudentSessionCookie(session.token)
    return NextResponse.json({
      ok: true,
      account: {
        fullName: account.fullName,
        familyName: clean(learner.parent_name, 180)
      }
    })
  } catch (error) {
    console.error("Group learner sign-in failed", error)
    return NextResponse.json(
      { ok: false, error: "Could not sign in with group code." },
      { status: 500 }
    )
  }
}

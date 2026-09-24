import { createHmac, randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { askId, askText, AskInputError } from "@/lib/ask-validation"

export const ASK_PAGE_SIZE = 12

// These selections never return pending responses or internal moderation fields.
export const publicAskSelect = {
  id: true, kind: true, body: true, facebookUrl: true, acceptingAnswers: true,
  publishedAt: true,
  _count: { select: { answers: { where: { status: "published" } } } }
} as const

export async function listPublicQuestions(page: number) {
  return prisma.askQuestion.findMany({
    where: { status: "published" }, select: publicAskSelect,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * ASK_PAGE_SIZE, take: ASK_PAGE_SIZE + 1
  })
}

export async function getPublicQuestion(id: string, page: number) {
  askId(id)
  return prisma.askQuestion.findFirst({
    where: { id, status: "published" },
    select: {
      ...publicAskSelect,
      answers: {
        where: { status: "published" }, select: { id: true, body: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * ASK_PAGE_SIZE, take: ASK_PAGE_SIZE + 1
      }
    }
  })
}

export async function getAnswerPrompt(id: string) {
  askId(id)
  return prisma.askQuestion.findFirst({
    where: { id, kind: "prompt", status: { in: ["published", "unlisted"] } },
    select: { id: true, body: true, acceptingAnswers: true }
  })
}

export async function consumeAskRateLimit(ip: string, now = new Date()) {
  const secret = process.env.RECAPTCHA_SECRET_KEY || process.env.DATABASE_URL
  if (!secret) throw new Error("Ask rate limiting is not configured")
  const window = Math.floor(now.getTime() / 3_600_000)
  const key = createHmac("sha256", secret).update(`ask:${window}:${ip || "unknown"}`).digest("hex")
  const expiresAt = new Date((window + 1) * 3_600_000)
  // Atomic database increments work across instances; no IP is saved with content.
  const bucket = await prisma.askRateLimit.upsert({
    where: { key }, create: { key, count: 1, expiresAt }, update: { count: { increment: 1 } }
  })
  await prisma.askRateLimit.deleteMany({ where: { expiresAt: { lte: now } } })
  return { allowed: bucket.count <= 5, retryAfter: Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)) }
}

export async function submitAsk(input: { body: unknown; questionId?: unknown }) {
  const body = askText(input.body)
  if (input.questionId !== undefined && input.questionId !== null && input.questionId !== "") {
    const questionId = askId(input.questionId)
    // The lock serializes submission with closing, archiving, or unpublishing a prompt.
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM ask_questions
        WHERE id = ${questionId} AND kind = 'prompt' AND status IN ('published', 'unlisted') AND accepting_answers = true
        FOR UPDATE
      `
      if (!rows.length) throw new AskInputError("This question is no longer accepting answers.")
      await tx.askAnswer.create({ data: { id: randomUUID(), questionId, body, status: "pending" } })
    })
  }
  await prisma.askQuestion.create({ data: { id: randomUUID(), kind: "visitor", body, status: "pending", acceptingAnswers: false } })
}

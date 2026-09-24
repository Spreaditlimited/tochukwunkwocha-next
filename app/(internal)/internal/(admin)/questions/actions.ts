"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { askFacebookUrl, askId, askStatus, askQuestionStatus, isQuestionPublished, askText, AskInputError } from "@/lib/ask-validation"

export type AskAdminState = { error?: string; message?: string; createdId?: string }

function refresh(id: string) {
  revalidatePath("/ask")
  revalidatePath(`/ask/${id}`)
  revalidatePath(`/ask/${id}/answer`)
  revalidatePath("/internal/questions")
}

export async function saveQuestionAction(_state: AskAdminState, form: FormData): Promise<AskAdminState> {
  await requireAdmin("/internal/questions")
  try {
    const status = askQuestionStatus(form.get("status"))
    const facebookUrl = askFacebookUrl(form.get("facebookUrl"))
    const existingId = form.get("id")
    const id = existingId ? askId(existingId) : randomUUID()
    await prisma.$transaction(async (tx) => {
      if (!existingId) {
        await tx.askQuestion.create({ data: {
          id, kind: "prompt", body: askText(form.get("body")), status, facebookUrl,
          acceptingAnswers: form.get("acceptingAnswers") === "on",
          publishedAt: isQuestionPublished(status) ? new Date() : null
        } })
        return
      }
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM ask_questions WHERE id = ${id} FOR UPDATE`
      if (!rows.length) throw new AskInputError("Question not found. Refresh this page.")
      const existing = await tx.askQuestion.findUniqueOrThrow({ where: { id } })
      if (form.get("version") !== existing.updatedAt.toISOString()) throw new AskInputError("This question has changed in another tab. Refresh before saving.")
      await tx.askQuestion.update({ where: { id }, data: {
        // Keep the original anonymous question intact; only author-owned prompts are editable.
        body: existing.kind === "prompt" ? askText(form.get("body")) : existing.body,
        status, facebookUrl,
        acceptingAnswers: existing.kind === "prompt" && form.get("acceptingAnswers") === "on",
        publishedAt: isQuestionPublished(status) ? existing.publishedAt || new Date() : null
      } })
    })
    refresh(id)
    return { message: status === "published" ? "Published and visible on /ask." : status === "unlisted" ? "Published but hidden from public pages. Audience questions can receive answers through their shareable link." : "Saved privately. This question is not visible on /ask.", createdId: existingId ? undefined : id }
  } catch (error) {
    return { error: error instanceof AskInputError ? error.message : "Could not save this question. Please try again." }
  }
}

export async function moderateAnswerAction(_state: AskAdminState, form: FormData): Promise<AskAdminState> {
  await requireAdmin("/internal/questions")
  try {
    const id = askId(form.get("id"))
    const status = askStatus(form.get("status"))
    const questionId = await prisma.$transaction(async (tx) => {
      const answer = await tx.askAnswer.findUnique({ where: { id } })
      if (!answer) throw new AskInputError("Answer not found. Refresh this page.")
      const rows = await tx.$queryRaw<{ status: string; kind: string }[]>`SELECT status, kind FROM ask_questions WHERE id = ${answer.questionId} FOR UPDATE`
      if (status === "published" && (!isQuestionPublished(rows[0]?.status || "") || rows[0]?.kind !== "prompt")) {
        throw new AskInputError("Publish the audience question before publishing its answers.")
      }
      const updated = await tx.askAnswer.updateMany({
        where: { id, updatedAt: new Date(String(form.get("version"))) }, data: { status }
      })
      if (!updated.count) throw new AskInputError("This answer has changed in another tab. Refresh before saving.")
      return answer.questionId
    })
    refresh(questionId)
    return { message: status === "published" ? "Anonymous answer published." : "Answer saved privately." }
  } catch (error) {
    return { error: error instanceof AskInputError ? error.message : "Could not update this answer. Please try again." }
  }
}

export async function unpublishQuestionAction(_state: AskAdminState, form: FormData): Promise<AskAdminState> {
  await requireAdmin("/internal/questions")
  try {
    const id = askId(form.get("id"))
    const version = new Date(String(form.get("version") || ""))
    if (!Number.isFinite(version.getTime())) throw new AskInputError("Refresh this page before unpublishing.")
    const result = await prisma.askQuestion.updateMany({
      where: { id, status: { in: ["published", "unlisted"] }, updatedAt: version },
      data: { status: "draft", publishedAt: null }
    })
    if (!result.count) throw new AskInputError("This question has changed or is already unpublished. Refresh this page.")
    refresh(id)
    return { message: "Question unpublished. Its answers are hidden and the answer link is inactive. Everything is saved as a private draft." }
  } catch (error) {
    return { error: error instanceof AskInputError ? error.message : "Could not unpublish this question. Please try again." }
  }
}

export async function deleteQuestionAction(_state: AskAdminState, form: FormData): Promise<AskAdminState> {
  await requireAdmin("/internal/questions")
  try {
    const id = askId(form.get("id"))
    const version = new Date(String(form.get("version") || ""))
    if (!Number.isFinite(version.getTime())) throw new AskInputError("Refresh this page before deleting.")
    // Check visibility and version atomically. Related answers are removed by the FK cascade.
    const result = await prisma.askQuestion.deleteMany({
      where: { id, status: { in: ["draft", "pending", "archived"] }, updatedAt: version }
    })
    if (!result.count) throw new AskInputError("Could not delete this question. Published questions must be unpublished first. Refresh this page to check its latest status.")
    refresh(id)
    return { message: "Question and all its answers permanently deleted." }
  } catch (error) {
    return { error: error instanceof AskInputError ? error.message : "Could not delete this question. Please try again." }
  }
}

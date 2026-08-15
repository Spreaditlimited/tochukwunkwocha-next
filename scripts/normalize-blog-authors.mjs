import fs from "node:fs"
import { PrismaClient } from "@prisma/client"

function loadDotEnv(path = ".env") {
  if (!fs.existsSync(path)) return
  for (const rawLine of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#") || !line.includes("=")) continue
    const key = line.slice(0, line.indexOf("=")).trim()
    let value = line.slice(line.indexOf("=") + 1).trim()
    if (!key || process.env[key] != null) continue
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    process.env[key] = value
  }
}

loadDotEnv()
const prisma = new PrismaClient()
const apply = process.argv.includes("--apply")
const author = "Tochukwu Nkwocha"

async function main() {
  const [total, alreadyCorrect, existingAuthors] = await Promise.all([
    prisma.tochukwuBlogPost.count(),
    prisma.tochukwuBlogPost.count({ where: { blogBy: author } }),
    prisma.tochukwuBlogPost.groupBy({ by: ["blogBy"], _count: { _all: true } })
  ])

  const requiringUpdate = total - alreadyCorrect
  if (apply && requiringUpdate > 0) {
    await prisma.tochukwuBlogPost.updateMany({
      where: { NOT: { blogBy: author } },
      data: { blogBy: author }
    })
  }

  const correctAfter = apply
    ? await prisma.tochukwuBlogPost.count({ where: { blogBy: author } })
    : alreadyCorrect

  process.stdout.write(`${JSON.stringify({
    mode: apply ? "applied" : "dry-run",
    total,
    requiringUpdate,
    correctAfter,
    existingAuthors: existingAuthors.map((entry) => ({ author: entry.blogBy, count: entry._count._all }))
  }, null, 2)}\n`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())

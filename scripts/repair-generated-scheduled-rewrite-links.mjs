import fs from "node:fs"

const checkpointPath = "/private/tmp/tochukwu-scheduled-blog-rewrites.json"
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"))
const replacements = new Map([
  ["https://www.ndpc.gov.ng/ndp-act-2023/", "https://ndpc.gov.ng/download/nigeria-data-protection-act-2023"]
])
let replacementsApplied = 0

for (const rewrite of Object.values(checkpoint.rewrites)) {
  for (const [before, after] of replacements) {
    const occurrences = rewrite.html.split(before).length - 1
    if (!occurrences) continue
    rewrite.html = rewrite.html.split(before).join(after)
    replacementsApplied += occurrences
  }
}

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ replacementsApplied, checkpointPath }, null, 2)}\n`)

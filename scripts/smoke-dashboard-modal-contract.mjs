import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const projectRoot = process.cwd()
const sourceRoots = ["app", "components"]
const sharedModalPath = path.join("components", "dashboard", "DashboardModal.tsx")
const allowedStandaloneDialogs = new Set([
  path.join("components", "LeadCapturePopup.tsx")
])
const legacyModalFiles = [
  path.join("components", "AccessCodeResetButton.tsx"),
  path.join("components", "BlogContentEditor.tsx"),
  path.join("components", "schools", "AdvancedSeatPurchaseForm.tsx"),
  path.join("components", "student-dashboard", "CertificateActionsPanel.tsx"),
  path.join("components", "student-dashboard", "player", "CoursePlayer.tsx"),
  path.join("app", "(internal)", "internal", "(admin)", "video-library", "AccessibilityGenerateButton.tsx"),
  path.join("app", "(internal)", "internal", "(admin)", "video-library", "LessonMapperClient.tsx"),
  path.join("app", "(internal)", "internal", "(admin)", "video-library", "ModuleDescriptionField.tsx")
]

function collectSourceFiles(relativeDirectory) {
  const absoluteDirectory = path.join(projectRoot, relativeDirectory)
  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(relativePath)
    return /\.(tsx|jsx)$/.test(entry.name) ? [relativePath] : []
  })
}

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exitCode = 1
}

const sharedModalSource = fs.readFileSync(path.join(projectRoot, sharedModalPath), "utf8")
const leadCapturePopupSource = fs.readFileSync(path.join(projectRoot, "components", "LeadCapturePopup.tsx"), "utf8")
const requiredBehaviors = [
  ["role=dialog", /role="dialog"/],
  ["aria-modal", /aria-modal="true"/],
  ["Escape dismissal", /event\.key === "Escape"/],
  ["focus containment", /event\.key !== "Tab"/],
  ["focus restoration", /previousFocusRef\.current\?\.focus/],
  ["scroll locking", /document\.body\.style\.overflow = "hidden"/],
  ["document-body portal", /createPortal\([\s\S]*document\.body/]
]

for (const [label, pattern] of requiredBehaviors) {
  if (!pattern.test(sharedModalSource)) fail(`DashboardModal is missing ${label}.`)
}

if (!/max-h-\[calc\(100dvh-2rem\)\]/.test(leadCapturePopupSource)) {
  fail("LeadCapturePopup must stay within the mobile dynamic viewport.")
}
if (!/min-h-0 overflow-y-auto overscroll-contain/.test(leadCapturePopupSource)) {
  fail("LeadCapturePopup must scroll its body while keeping the close control visible.")
}
if (!/min-h-11 min-w-11/.test(leadCapturePopupSource)) {
  fail("LeadCapturePopup close control must keep a mobile-friendly touch target.")
}
if (!/z-\[120\]/.test(leadCapturePopupSource)) {
  fail("LeadCapturePopup must render above the fixed mobile site header.")
}

for (const relativePath of legacyModalFiles) {
  const source = fs.readFileSync(path.join(projectRoot, relativePath), "utf8")
  if (!source.includes("DashboardModal")) fail(`${relativePath} no longer uses DashboardModal.`)
}

for (const relativePath of sourceRoots.flatMap(collectSourceFiles)) {
  if (relativePath === sharedModalPath || allowedStandaloneDialogs.has(relativePath)) continue
  const source = fs.readFileSync(path.join(projectRoot, relativePath), "utf8")
  const definesDialogSemantics = /role="dialog"|aria-modal=/.test(source)
  const definesModalOverlay = /fixed inset-0[^"\n]*(?:backdrop-blur|bg-(?:black|slate)|bg-background\/90)/.test(source)
  if (definesDialogSemantics || definesModalOverlay) {
    fail(`${relativePath} defines a standalone modal. Use components/dashboard/DashboardModal.tsx.`)
  }
}

if (!process.exitCode) {
  console.log(`PASS: dashboard modal contract is centralized across ${legacyModalFiles.length} migrated surfaces.`)
}

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")

const page = read("app/(internal)/internal/(admin)/video-library/page.tsx")
const selector = read("app/(internal)/internal/(admin)/video-library/ModuleBuilderSelector.tsx")
const actions = read("app/(internal)/internal/(admin)/video-library/actions.ts")
const library = read("lib/admin-video-library.ts")

assert.match(page, /course: module\.courseSlug,[\s\S]*moduleCourse: module\.courseSlug,[\s\S]*moduleId: module\.id[\s\S]*\+ "#module-builder"/)
assert.match(page, /key=\{selectedModule \? `\$\{selectedModule\.courseSlug\}:\$\{String\(selectedModule\.id\)\}`/)
assert.match(page, /name="moduleId" value=\{selectedModule \? String\(selectedModule\.id\) : ""\}/)
assert.match(page, /name="openedCourseSlug" value=\{selectedModule\?\.courseSlug \|\| ""\}/)
assert.match(page, /defaultValue=\{selectedModule\?\.moduleTitle \|\| ""\}/)
assert.match(page, /defaultValue=\{selectedModule\?\.moduleDescription \|\| ""\}/)

assert.match(selector, /query\.set\("moduleId", selected\.id\)/)
assert.match(selector, /query\.set\("course", selected\.courseSlug\)/)
assert.match(selector, /query\.set\("moduleCourse", selected\.courseSlug\)/)
assert.match(selector, /#module-builder/)

assert.match(actions, /courseSlug: submittedCourseSlug \|\| openedCourseSlug/)
assert.match(library, /const courseSlug = submittedCourseSlug \? slugify\(submittedCourseSlug\)\.slice\(0, 120\) : ""/)
assert.match(library, /if \(!courseSlug \|\| !moduleTitle\) throw new Error\("Course and module title are required\."\)/)

console.log("PASS: opening an existing video-library module loads a fresh editor bound to its module ID and course.")

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { runInNewContext } from "node:vm"

const source = readFileSync(new URL("../components/ThemeScript.tsx", import.meta.url), "utf8")
const script = source.match(/const themeScript = `([\s\S]*?)`/)[1]

function initialize(stored, { prefersDark = false, storageBlocked = false, legacyTheme = null } = {}) {
  const classes = new Set()
  const root = {
    classList: {
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
      remove: (name) => classes.delete(name)
    },
    dataset: {},
    style: {}
  }
  runInNewContext(script, {
    document: { documentElement: root },
    window: { matchMedia: () => ({ matches: prefersDark }) },
    localStorage: {
      getItem: (key) => {
        if (storageBlocked) throw new Error("Storage blocked")
        if (key === "tochukwu-theme") return legacyTheme
        assert.equal(key, "tochukwu-theme-choice")
        return stored
      },
      setItem: () => assert.fail("Default theme must not be saved as an explicit preference")
    }
  })
  return { theme: root.dataset.theme, colorScheme: root.style.colorScheme, dark: classes.has("dark") }
}

test("new visitors default to light regardless of device theme", () => {
  for (const prefersDark of [false, true]) {
    assert.deepEqual(initialize(null, { prefersDark }), { theme: "light", colorScheme: "light", dark: false })
  }
})

test("explicit light and dark choices under the new policy are preserved", () => {
  for (const theme of ["light", "dark"]) {
    assert.deepEqual(initialize(theme), { theme, colorScheme: theme, dark: theme === "dark" })
  }
})

test("legacy auto-saved dark settings no longer override the light default", () => {
  assert.deepEqual(initialize(null, { prefersDark: true, legacyTheme: "dark" }), { theme: "light", colorScheme: "light", dark: false })
  assert.deepEqual(initialize("light", { legacyTheme: "dark" }), { theme: "light", colorScheme: "light", dark: false })
})

test("theme toggle saves to the same explicit-choice key used at startup", () => {
  const toggle = readFileSync(new URL("../components/ThemeToggle.tsx", import.meta.url), "utf8")
  assert.match(toggle, /localStorage\.setItem\("tochukwu-theme-choice", nextTheme\)/)
  assert.doesNotMatch(toggle, /localStorage\.setItem\("tochukwu-theme",/)
})

test("invalid or inaccessible preferences fall back to light", () => {
  for (const result of [initialize("system", { prefersDark: true }), initialize(null, { storageBlocked: true })]) {
    assert.deepEqual(result, { theme: "light", colorScheme: "light", dark: false })
  }
})

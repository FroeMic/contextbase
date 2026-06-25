import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("app stylesheet", () => {
  test("uses the Linear-like Inter variable font stack", () => {
    const source = readFileSync(join(process.cwd(), "src/styles/app.css"), "utf8")
    const packageJson = readFileSync(join(process.cwd(), "package.json"), "utf8")

    expect(source).toContain('@import "@fontsource-variable/inter";')
    expect(source).toContain('--font-sans: "Inter Variable", Arial, Helvetica, sans-serif;')
    expect(source).not.toContain("@fontsource-variable/figtree")
    expect(packageJson).toContain('"@fontsource-variable/inter"')
    expect(packageJson).not.toContain('"@fontsource-variable/figtree"')
  })

  test("smooths app text rendering globally", () => {
    const source = readFileSync(join(process.cwd(), "src/styles/app.css"), "utf8")

    expect(source).toContain("-webkit-font-smoothing: antialiased;")
    expect(source).toContain("-moz-osx-font-smoothing: grayscale;")
  })

  test("sets the document canvas to the app background color", () => {
    const source = readFileSync(join(process.cwd(), "src/styles/app.css"), "utf8")

    expect(source).toContain("html {")
    expect(source).toContain("background-color: var(--background);")
  })

  test("disables color animation utilities for theme changes", () => {
    const source = readFileSync(join(process.cwd(), "src/styles/app.css"), "utf8")

    expect(source).toContain(".transition-colors")
    expect(source).toContain("transition-property: none;")
    expect(source).toContain(".transition-all")
    expect(source).toContain(
      "transition-property: opacity, transform, translate, scale, rotate, filter, backdrop-filter;",
    )
  })
})

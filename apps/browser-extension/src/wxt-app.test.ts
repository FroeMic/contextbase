import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, test } from "vitest"

const appRoot = resolve(import.meta.dirname, "..")

describe("WXT React extension app", () => {
  test("uses WXT, React, and TypeScript as the extension runtime scaffold", () => {
    const packageJson = JSON.parse(readFileSync(resolve(appRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      scripts?: Record<string, string>
    }

    expect(packageJson.scripts?.build).toBe("wxt build")
    expect(packageJson.scripts?.dev).toBe("wxt")
    expect(packageJson.scripts?.e2e).toBe("pnpm build && playwright test")
    expect(packageJson.dependencies).toHaveProperty("react")
    expect(packageJson.dependencies).toHaveProperty("react-dom")
    expect(packageJson.devDependencies).toHaveProperty("@vitejs/plugin-react")
    expect(packageJson.devDependencies).toHaveProperty("@wxt-dev/module-react")
    expect(packageJson.devDependencies).toHaveProperty("wxt")
  })

  test("has permission to recover content scripts for already-open ChatGPT tabs", () => {
    const configSource = readFileSync(resolve(appRoot, "wxt.config.ts"), "utf8")

    expect(configSource).toContain('"scripting"')
  })

  test("keeps hydrated image bytes out of Chrome runtime content-script messages", () => {
    const contentScriptSource = readFileSync(
      resolve(appRoot, "src/content-scripts/chatgpt.ts"),
      "utf8",
    )

    expect(contentScriptSource).not.toContain("hydrateChatGptImageArtifacts(")
    expect(contentScriptSource).toContain("extractChatGptSession(document")
  })

  test("keeps WXT entrypoints and E2E tests checked in", () => {
    expect(existsSync(resolve(appRoot, "wxt.config.ts"))).toBe(true)
    expect(existsSync(resolve(appRoot, "entrypoints/background.ts"))).toBe(true)
    expect(existsSync(resolve(appRoot, "entrypoints/chatgpt.content.ts"))).toBe(true)
    expect(existsSync(resolve(appRoot, "entrypoints/popup/index.html"))).toBe(true)
    expect(existsSync(resolve(appRoot, "entrypoints/popup/main.tsx"))).toBe(true)
    expect(existsSync(resolve(appRoot, "e2e/manual-capture.spec.ts"))).toBe(true)
  })

  test("guides setup with one token path visible at a time before showing capture actions", () => {
    const popupSource = readFileSync(resolve(appRoot, "entrypoints/popup/main.tsx"), "utf8")

    expect(popupSource).toContain('type SetupMode = "pair" | "existing"')
    expect(popupSource).toContain("Pair with API token")
    expect(popupSource).toContain("Use existing capture token")
    expect(popupSource).toContain("Complete Setup")
    expect(popupSource).toContain("Connection Ready")
    expect(popupSource).not.toContain("<span>Temporary API token</span>")
    expect(popupSource).not.toContain("<span>Existing capture token</span>")
  })
})

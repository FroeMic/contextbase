import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

const landingRoutes = {
  "/": "index.tsx",
} as const

function routeSource(file: string) {
  return readFileSync(join(process.cwd(), "src/routes", file), "utf8")
}

function landingSource(path: string) {
  return readFileSync(join(process.cwd(), "src/domains/landing", path), "utf8")
}

describe("landing routes", () => {
  test("serve the public landing pages as thin TanStack Start route adapters", () => {
    for (const [path, file] of Object.entries(landingRoutes)) {
      const source = routeSource(file)

      expect(source).toContain(`createFileRoute("${path}")`)
      expect(source).toContain("../domains/landing/")
      expect(source).not.toContain("<main")
      expect(source).not.toContain("<form")
      expect(source).not.toContain("<video")
    }
  })

  test("keeps the root landing page as a simple text-only first fold", () => {
    const source = landingSource("pages/HomeLandingPage.tsx")

    expect(source).toContain("Workspace Memory for AI Sessions")
    expect(source).toContain("Contextbase is the local-first foundation")
    expect(source).toContain("provider")
    expect(source).not.toContain("<video")
    expect(source).not.toContain("LandingWaitlistModalClient")
    expect(source).not.toContain("data-waitlist-open")
  })

  test("keeps the root landing page independent from anonymous waitlist behavior", () => {
    const source = landingSource("pages/HomeLandingPage.tsx")

    expect(source).toContain("isSignedIn")
    expect(source).not.toContain("Request access")
    expect(source).not.toContain("#waitlist")
    expect(source).not.toContain("data-landing-waitlist-modal")
  })

  test("do not depend on the legacy custom landing server", () => {
    for (const file of Object.values(landingRoutes)) {
      const source = routeSource(file)

      expect(source).not.toContain("renderToString")
      expect(source).not.toContain("Hono")
    }
  })
})

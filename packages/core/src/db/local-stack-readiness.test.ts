import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, test } from "vitest"

describe("local Docker stack readiness", () => {
  test("local-domain startup reruns migrations and verifies Zero publication", () => {
    const repoRoot = resolve(import.meta.dirname, "../../../..")
    const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>
    }
    const scriptSource = readFileSync(resolve(repoRoot, "scripts/local-domains-docker.mjs"), "utf8")

    expect(packageJson.scripts?.["local:domains:docker:1"]).toBe(
      "node scripts/local-domains-docker.mjs up 1",
    )
    expect(packageJson.scripts?.["local:domains:docker:2"]).toBe(
      "node scripts/local-domains-docker.mjs up 2",
    )
    expect(scriptSource).toContain("--force-recreate")
    expect(scriptSource).toContain("migrate")
    expect(scriptSource).toContain("scripts/verify-zero-publication.mjs")
    expect(scriptSource).toContain("zero-cache")
  })
})

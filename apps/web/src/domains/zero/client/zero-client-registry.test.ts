import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, test } from "vitest"

describe("Zero client registry", () => {
  test("ZeroClientProvider uses the shared browser Zero instance", () => {
    const providerSource = readFileSync(
      join(process.cwd(), "src/domains/zero/client/ZeroClientProvider.tsx"),
      "utf8",
    )

    expect(providerSource).toContain("getOrCreateBrowserZero")
    expect(providerSource).toContain("<ZeroProvider zero={zero}>")
  })

  test("shared Zero clients keep a client-state reset path", () => {
    const registrySource = readFileSync(
      join(process.cwd(), "src/domains/zero/client/zero-client-registry.ts"),
      "utf8",
    )
    const providerSource = readFileSync(
      join(process.cwd(), "src/domains/zero/client/ZeroClientProvider.tsx"),
      "utf8",
    )

    expect(registrySource).toContain("onClientStateNotFound")
    expect(registrySource).toContain("ZERO_CLIENT_RESET_EVENT")
    expect(providerSource).toContain("ZERO_CLIENT_RESET_EVENT")
  })
})

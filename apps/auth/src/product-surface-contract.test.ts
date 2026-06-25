import { readFile } from "node:fs/promises"
import { describe, expect, test } from "vitest"

async function readSource(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8")
}

describe("auth product surface contract", () => {
  test("does not expose copied agent product flows in OAuth consent", async () => {
    const appSource = await readSource("./app.ts")
    const runtimeSource = await readSource("./server-runtime.ts")

    expect(appSource).not.toMatch(/@contextbase\/core\/domains\/agents/)
    expect(runtimeSource).not.toMatch(/@contextbase\/core\/domains\/agents/)
    expect(appSource).not.toContain("agentStore")
    expect(appSource).not.toContain("create_agent")
    expect(appSource).not.toContain("Create a new agent")
    expect(appSource).not.toMatch(/Agent:\s*\$\{/)
    expect(appSource).not.toContain("agent_display_name")
  })

  test("brands OAuth consent as Contextbase", async () => {
    const appSource = await readSource("./app.ts")

    expect(appSource).toContain("Contextbase authorization")
    expect(appSource).toContain("to Contextbase")
    expect(appSource).not.toContain("Vertical authorization")
    expect(appSource).not.toContain("to Vertical")
  })
})

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

import { createPublicCliCommand } from "./public-cli.js"
import { createRootCommand } from "./root.js"

const cliSrc = join(process.cwd(), "src")

function exists(path: string) {
  return existsSync(join(cliSrc, path))
}

function source(path: string) {
  return readFileSync(join(cliSrc, path), "utf8")
}

describe("Contextbase CLI product surface", () => {
  const removedCommandModules = [
    "agents",
    "approvals",
    "artifacts",
    "businesses",
    "chats",
    "comments",
    "contacts",
    "events",
    "execution-bindings",
    "goals",
    "labels",
    "organizations",
    "routines",
    "runtime",
    "tasks",
    "users",
  ]

  test("root command uses Contextbase naming", () => {
    const root = createRootCommand()

    expect(root.name()).toBe("contextbase")
    expect(root.description()).toContain("Contextbase")

    const rootSource = source("root.ts")
    expect(rootSource).not.toContain('.name("vertical")')
    expect(rootSource).not.toContain("Vertical API")
  })

  test("public CLI registers only Contextbase relevant command groups", async () => {
    const output: string[] = []
    const root = createPublicCliCommand({
      output: {
        writeErr: (message) => output.push(message),
        writeOut: (message) => output.push(message),
      },
    })

    await root.parseAsync(["node", "contextbase", "commands", "--json"])

    const data = JSON.parse(output.join("")).data as Array<{ examples: string[]; path: string[] }>
    const groups = new Set(data.map((metadata) => metadata.path[0]))

    expect([...groups].sort()).toEqual([
      "auth",
      "commands",
      "doctor",
      "files",
      "invitations",
      "members",
      "workspaces",
    ])

    for (const metadata of data) {
      for (const example of metadata.examples) {
        expect(example).toMatch(/^contextbase\b/)
      }
    }
  })

  test("does not keep copied command modules as active source", () => {
    for (const module of removedCommandModules) {
      expect(exists(`commands/${module}.ts`), `commands/${module}.ts should be removed`).toBe(false)
      expect(
        exists(`commands/${module}.test.ts`),
        `commands/${module}.test.ts should be removed`,
      ).toBe(false)
    }
  })

  test("public CLI source does not import copied command groups", () => {
    const publicCli = source("public-cli.ts")

    for (const module of removedCommandModules) {
      expect(publicCli).not.toContain(`./commands/${module}.js`)
    }
  })
})

import { describe, expect, test } from "vitest"

import { commandListCommand } from "../commands.js"
import { createCliRegistrationContext, registerCommands } from "../registry.js"
import { createRootCommand } from "../root.js"
import { createMembersCommand } from "./members.js"

describe("member commander commands", () => {
  test("list prints the API list envelope", async () => {
    const { output, requests, root } = createMemberCommandRoot({
      response: { data: [], ok: true, page: { next_cursor: null } },
    })

    await root.parseAsync([
      "node",
      "contextbase",
      "--api-url",
      "http://local.test",
      "members",
      "list",
      "--json",
    ])

    expect(requests).toEqual([
      { input: "http://local.test/api/v1/workspace-members", method: "GET" },
    ])
    expect(JSON.parse(output.join(""))).toEqual({
      data: [],
      ok: true,
      page: { next_cursor: null },
    })
  })

  test("update dry-run validates and prints the request without sending it", async () => {
    const { output, requests, root } = createMemberCommandRoot()

    await root.parseAsync([
      "node",
      "contextbase",
      "--dry-run",
      "members",
      "update",
      "mbr_123",
      "--role",
      "workspace_admin",
      "--json",
    ])

    expect(requests).toEqual([])
    expect(JSON.parse(output.join(""))).toEqual({
      data: {
        body: { role: "workspace_admin" },
        method: "PATCH",
        path: "/api/v1/workspace-members/mbr_123",
      },
      ok: true,
    })
  })

  test("commands metadata includes member commands", async () => {
    const { output, root } = createMemberCommandRoot({ includeCommandList: true })

    await root.parseAsync(["node", "contextbase", "commands", "--json"])

    const data = JSON.parse(output.join("")).data as Array<{ id: string }>
    expect(data.map((metadata) => metadata.id)).toEqual([
      "commands.list",
      "members.disable",
      "members.list",
      "members.reactivate",
      "members.update",
    ])
  })

  test("member command examples pass dry-run validation", async () => {
    const examples = [
      ["members", "list", "--json"],
      ["members", "update", "mbr_123", "--role", "workspace_admin", "--json"],
      ["members", "disable", "mbr_123", "--json"],
      ["members", "reactivate", "mbr_123", "--json"],
    ]

    for (const example of examples) {
      const { output, requests, root } = createMemberCommandRoot()

      await root.parseAsync(["node", "contextbase", "--dry-run", ...example])

      expect(requests).toEqual([])
      expect(JSON.parse(output.join(""))).toMatchObject({ ok: true })
    }
  })
})

function createMemberCommandRoot(
  options: { includeCommandList?: boolean; response?: unknown } = {},
) {
  const output: string[] = []
  const requests: Array<{ body?: string; input: string; method?: string }> = []
  const root = createRootCommand()
  const context = createCliRegistrationContext()

  root.exitOverride()
  root.configureOutput({
    writeErr: (message) => output.push(message),
    writeOut: (message) => output.push(message),
  })

  registerCommands(
    root,
    [
      ...(options.includeCommandList ? [commandListCommand] : []),
      createMembersCommand({
        fetch: async (input, init) => {
          requests.push({
            ...(typeof init?.body === "string" ? { body: init.body } : {}),
            input: String(input),
            ...(init?.method ? { method: init.method } : {}),
          })
          return new Response(
            JSON.stringify(options.response ?? { data: { id: "mbr_123" }, ok: true }),
          )
        },
      }),
    ],
    context,
  )

  return { output, requests, root }
}

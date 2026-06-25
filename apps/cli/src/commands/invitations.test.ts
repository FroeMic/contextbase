import { describe, expect, test } from "vitest"

import { commandListCommand } from "../commands.js"
import { createCliRegistrationContext, registerCommands } from "../registry.js"
import { createRootCommand } from "../root.js"
import { createInvitationsCommand } from "./invitations.js"

describe("invitation commander commands", () => {
  test("list prints the API list envelope", async () => {
    const { output, requests, root } = createInvitationCommandRoot({
      response: { data: [], ok: true, page: { next_cursor: null } },
    })

    await root.parseAsync([
      "node",
      "contextbase",
      "--api-url",
      "http://local.test",
      "invitations",
      "list",
      "--json",
    ])

    expect(requests).toEqual([
      { input: "http://local.test/api/v1/workspace-invitations", method: "GET" },
    ])
    expect(JSON.parse(output.join(""))).toEqual({
      data: [],
      ok: true,
      page: { next_cursor: null },
    })
  })

  test("create dry-run validates and prints the request without sending it", async () => {
    const { output, requests, root } = createInvitationCommandRoot()

    await root.parseAsync([
      "node",
      "contextbase",
      "--dry-run",
      "invitations",
      "create",
      "--email",
      "new@example.com",
      "--role",
      "workspace_member",
      "--json",
    ])

    expect(requests).toEqual([])
    expect(JSON.parse(output.join(""))).toEqual({
      data: {
        body: { email: "new@example.com", role: "workspace_member" },
        method: "POST",
        path: "/api/v1/workspace-invitations",
      },
      ok: true,
    })
  })

  test("revoke posts to the revoke endpoint", async () => {
    const { requests, root } = createInvitationCommandRoot()

    await root.parseAsync([
      "node",
      "contextbase",
      "--api-url",
      "http://local.test",
      "invitations",
      "revoke",
      "win_123",
      "--json",
    ])

    expect(requests).toEqual([
      {
        body: "{}",
        input: "http://local.test/api/v1/workspace-invitations/win_123/revoke",
        method: "POST",
      },
    ])
  })

  test("commands metadata includes invitation commands", async () => {
    const { output, root } = createInvitationCommandRoot({ includeCommandList: true })

    await root.parseAsync(["node", "contextbase", "commands", "--json"])

    const data = JSON.parse(output.join("")).data as Array<{ id: string }>
    expect(data.map((metadata) => metadata.id)).toEqual([
      "commands.list",
      "invitations.create",
      "invitations.list",
      "invitations.revoke",
    ])
  })
})

function createInvitationCommandRoot(
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
      createInvitationsCommand({
        fetch: async (input, init) => {
          requests.push({
            ...(typeof init?.body === "string" ? { body: init.body } : {}),
            input: String(input),
            ...(init?.method ? { method: init.method } : {}),
          })
          return new Response(
            JSON.stringify(options.response ?? { data: { id: "win_123" }, ok: true }),
          )
        },
      }),
    ],
    context,
  )

  return { output, requests, root }
}

import { describe, expect, test } from "vitest"

import { commandListCommand } from "../commands.js"
import { createCliRegistrationContext, registerCommands } from "../registry.js"
import { createRootCommand } from "../root.js"
import { createWorkspacesCommand, parseWorkspaceArgs } from "./workspaces.js"

describe("workspace commander commands", () => {
  test("list prints the API list envelope", async () => {
    const { output, requests, root } = createWorkspaceCommandRoot({
      response: { data: [], ok: true, page: { next_cursor: null } },
    })

    await root.parseAsync([
      "node",
      "contextbase",
      "--api-url",
      "http://local.test",
      "workspaces",
      "list",
      "--json",
    ])

    expect(requests).toEqual([{ input: "http://local.test/api/v1/workspaces", method: "GET" }])
    expect(JSON.parse(output.join(""))).toEqual({
      data: [],
      ok: true,
      page: { next_cursor: null },
    })
  })

  test("create dry-run validates and prints the request without sending it", async () => {
    const { output, requests, root } = createWorkspaceCommandRoot()

    await root.parseAsync([
      "node",
      "contextbase",
      "--dry-run",
      "workspaces",
      "create",
      "--workspace-name",
      "Core",
      "--workspace-slug",
      "core",
      "--json",
    ])

    expect(requests).toEqual([])
    expect(JSON.parse(output.join(""))).toEqual({
      data: {
        body: { workspaceName: "Core", workspaceSlug: "core" },
        method: "POST",
        path: "/api/v1/workspaces",
      },
      ok: true,
    })
  })

  test("commands metadata includes useful workspace options", async () => {
    const { output, root } = createWorkspaceCommandRoot({ includeCommandList: true })

    await root.parseAsync(["node", "contextbase", "commands", "--json"])

    const data = JSON.parse(output.join("")).data as Array<{
      id: string
      options: Array<{ name: string; required: boolean; type: string }>
    }>
    const create = data.find((metadata) => metadata.id === "workspaces.create")

    expect(data.map((metadata) => metadata.id)).toEqual([
      "commands.list",
      "workspaces.archive",
      "workspaces.create",
      "workspaces.get",
      "workspaces.list",
      "workspaces.reactivate",
      "workspaces.rename-slug",
      "workspaces.update",
    ])
    expect(create?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "workspace-name", required: true, type: "string" }),
        expect.objectContaining({ name: "workspace-slug", required: true, type: "string" }),
      ]),
    )
  })

  test("workspace command examples pass dry-run validation", async () => {
    const examples = [
      ["workspaces", "list", "--json"],
      ["workspaces", "create", "--workspace-name", "Core", "--workspace-slug", "core", "--json"],
      ["workspaces", "get", "core", "--json"],
      ["workspaces", "update", "core", "--workspace-name", "Core", "--json"],
      ["workspaces", "archive", "core", "--json"],
      ["workspaces", "reactivate", "core", "--json"],
      ["workspaces", "rename-slug", "core", "--new-slug", "new-core", "--json"],
    ]

    for (const example of examples) {
      const { output, requests, root } = createWorkspaceCommandRoot()

      await root.parseAsync(["node", "contextbase", "--dry-run", ...example])

      expect(requests).toEqual([])
      expect(JSON.parse(output.join(""))).toMatchObject({ ok: true })
    }
  })
})

describe("workspace command arguments", () => {
  test("parses create args with json output", () => {
    expect(
      parseWorkspaceArgs([
        "create",
        "--workspace-name",
        "Core",
        "--workspace-slug",
        "core",
        "--json",
      ]),
    ).toEqual({
      command: "create",
      json: true,
      workspaceName: "Core",
      workspaceSlug: "core",
    })
  })

  test("parses get, update, lifecycle, and rename args", () => {
    expect(parseWorkspaceArgs(["get", "core", "--json"])).toEqual({
      command: "get",
      json: true,
      workspaceIdOrSlug: "core",
    })
    expect(parseWorkspaceArgs(["update", "core", "--workspace-name", "New"])).toEqual({
      command: "update",
      json: false,
      workspaceIdOrSlug: "core",
      workspaceName: "New",
    })
    expect(parseWorkspaceArgs(["archive", "core", "--json"])).toEqual({
      command: "archive",
      json: true,
      workspaceIdOrSlug: "core",
    })
    expect(parseWorkspaceArgs(["reactivate", "core"])).toEqual({
      command: "reactivate",
      json: false,
      workspaceIdOrSlug: "core",
    })
    expect(parseWorkspaceArgs(["rename-slug", "core", "--new-slug", "new-core"])).toEqual({
      command: "rename-slug",
      json: false,
      newSlug: "new-core",
      workspaceIdOrSlug: "core",
    })
  })
})

function createWorkspaceCommandRoot(
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
      createWorkspacesCommand({
        fetch: async (input, init) => {
          requests.push({
            ...(typeof init?.body === "string" ? { body: init.body } : {}),
            input: String(input),
            ...(init?.method ? { method: init.method } : {}),
          })
          return new Response(
            JSON.stringify(options.response ?? { data: { id: "wrk_123" }, ok: true }),
          )
        },
      }),
    ],
    context,
  )

  return { output, requests, root }
}

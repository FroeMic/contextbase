import { describe, expect, test } from "vitest"

import { commandListCommand } from "../commands.js"
import { createCliRegistrationContext, registerCommands } from "../registry.js"
import { createRootCommand } from "../root.js"
import { createFilesCommand } from "./files.js"

describe("file commander commands", () => {
  test("dry-runs file downloads", async () => {
    const { output, requests, root } = createFileCommandRoot()

    await root.parseAsync([
      "node",
      "contextbase",
      "--dry-run",
      "files",
      "download",
      "file_123",
      "./screenshot.png",
      "--json",
    ])

    expect(requests).toEqual([])
    expect(output.map((entry) => JSON.parse(entry))).toEqual([
      {
        data: {
          method: "GET",
          outputPath: "./screenshot.png",
          path: "/api/v1/files/file_123/content",
        },
        ok: true,
      },
    ])
  })

  test("does not register copied file metadata or delete commands", async () => {
    const { root } = createFileCommandRoot()

    await expect(
      root.parseAsync(["node", "contextbase", "files", "get", "file_123", "--json"]),
    ).rejects.toThrow("unknown command 'get'")

    await expect(
      root.parseAsync(["node", "contextbase", "files", "delete", "file_123", "--yes", "--json"]),
    ).rejects.toThrow("unknown command 'delete'")
  })

  test("metadata records only Contextbase file commands", async () => {
    const { output, root } = createFileCommandRoot({ includeCommandList: true })

    await root.parseAsync(["node", "contextbase", "commands", "--json"])

    const data = JSON.parse(output.join("")).data as Array<{ id: string; path: string[] }>

    expect(data.map((metadata) => metadata.id)).toEqual(["commands.list", "files.download"])
    expect(new Set(data.map((metadata) => metadata.path[0]))).toEqual(
      new Set(["commands", "files"]),
    )
  })
})

function createFileCommandRoot(options: { includeCommandList?: boolean } = {}) {
  const output: string[] = []
  const requests: Array<{ body?: unknown; input: string; method: string }> = []
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
      createFilesCommand({
        fetch: async (input, init) => {
          requests.push({ body: init?.body, input: String(input), method: init?.method ?? "GET" })
          return new Response(JSON.stringify({ data: {}, ok: true }))
        },
      }),
    ],
    context,
  )
  return { output, requests, root }
}

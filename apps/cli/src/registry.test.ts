import { describe, expect, test } from "vitest"

import { commandListCommand } from "./commands.js"
import {
  type CliCommandModule,
  createCliRegistrationContext,
  registerCommands,
} from "./registry.js"
import { createRootCommand } from "./root.js"

describe("CLI command registry", () => {
  test("registers only supplied command modules and exposes sorted metadata", () => {
    const context = createCliRegistrationContext()
    const root = createRootCommand()
    const hiddenCommand = createCommandModule("runtime.queue", ["runtime", "queue"])
    const visibleCommand = createCommandModule("tasks.list", ["tasks", "list"])

    registerCommands(root, [visibleCommand], context)

    expect(root.commands.map((command) => command.name())).toContain("tasks")
    expect(root.commands.map((command) => command.name())).not.toContain("runtime")
    expect(context.getCommandMetadata().map((metadata) => metadata.id)).toEqual(["tasks.list"])
    expect(hiddenCommand.metadata.id).toBe("runtime.queue")
  })

  test("prints registered command metadata as JSON", async () => {
    const context = createCliRegistrationContext()
    const root = createRootCommand()
    const output: string[] = []

    root.exitOverride()
    root.configureOutput({
      writeOut: (message) => output.push(message),
      writeErr: (message) => output.push(message),
    })

    registerCommands(
      root,
      [commandListCommand, createCommandModule("tasks.list", ["tasks", "list"])],
      context,
    )

    await root.parseAsync(["node", "contextbase", "commands", "--json"])

    expect(JSON.parse(output.join(""))).toEqual({
      data: [
        expect.objectContaining({
          id: "commands.list",
          path: ["commands"],
        }),
        expect.objectContaining({
          id: "tasks.list",
          path: ["tasks", "list"],
        }),
      ],
      ok: true,
    })
  })
})

function createCommandModule(id: string, path: string[]): CliCommandModule {
  return {
    metadata: {
      arguments: [],
      description: `Description for ${id}`,
      examples: [`contextbase ${path.join(" ")} --json`],
      id,
      options: [],
      output: {
        dryRun: true,
        json: true,
      },
      path,
      summary: `Summary for ${id}`,
    },
    register: (root) => {
      const [group, subcommand] = path
      if (!group) return
      let groupCommand = root.commands.find((command) => command.name() === group)
      if (!groupCommand) {
        groupCommand = root.createCommand(group)
        root.addCommand(groupCommand)
      }
      if (subcommand) {
        groupCommand.addCommand(root.createCommand(subcommand))
      }
    },
  }
}

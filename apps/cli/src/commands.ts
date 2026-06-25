import type { CliCommandModule } from "./registry.js"

export const commandListCommand: CliCommandModule = {
  metadata: {
    arguments: [],
    description: "Print the registered Contextbase command surface as JSON.",
    examples: ["contextbase commands --json"],
    id: "commands.list",
    options: [
      {
        description: "Output JSON",
        name: "json",
        repeatable: false,
        required: false,
        type: "boolean",
      },
    ],
    output: {
      dryRun: true,
      json: true,
    },
    path: ["commands"],
    summary: "List registered commands",
  },
  register: (root, context) => {
    const command = root
      .command("commands")
      .description("List registered commands")
      .option("--json", "Output JSON")
      .action(() => {
        command
          .configureOutput()
          .writeOut?.(
            `${JSON.stringify({ ok: true, data: context.getCommandMetadata() }, null, 2)}\n`,
          )
      })
  },
}

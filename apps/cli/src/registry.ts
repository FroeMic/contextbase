import type { Command } from "@commander-js/extra-typings"

export type CliCommandArgumentMetadata = {
  description: string
  name: string
  required: boolean
}

export type CliCommandOptionMetadata = {
  description: string
  name: string
  repeatable: boolean
  required: boolean
  type: "boolean" | "date" | "enum" | "json" | "number" | "string"
  values?: string[]
}

export type CliCommandMetadata = {
  arguments: CliCommandArgumentMetadata[]
  description: string
  examples: string[]
  id: string
  options: CliCommandOptionMetadata[]
  output: {
    dryRun: boolean
    json: boolean
  }
  path: string[]
  summary: string
}

export type CliCommandModule = {
  metadata: CliCommandMetadata
  register: (root: Command, context: CliRegistrationContext) => void
}

export type CliRegistrationContext = {
  addCommandMetadata: (metadata: CliCommandMetadata) => void
  getCommandMetadata: () => CliCommandMetadata[]
}

export function createCliRegistrationContext(): CliRegistrationContext {
  const metadataById = new Map<string, CliCommandMetadata>()

  return {
    addCommandMetadata: (metadata) => {
      metadataById.set(metadata.id, metadata)
    },
    getCommandMetadata: () =>
      [...metadataById.values()].sort((left, right) =>
        left.path.join(" ").localeCompare(right.path.join(" ")),
      ),
  }
}

export function registerCommands(
  root: Command,
  commands: readonly CliCommandModule[],
  context: CliRegistrationContext,
) {
  for (const command of commands) {
    context.addCommandMetadata(command.metadata)
    command.register(root, context)
  }
}

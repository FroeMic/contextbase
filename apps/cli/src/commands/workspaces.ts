import { createApiClient } from "@contextbase/api-client"
import { createWorkspaceClient } from "@contextbase/api-client/domains/workspaces"
import {
  WorkspaceCreateBodySchema,
  WorkspaceIdOrSlugParamsSchema,
  WorkspaceRenameSlugBodySchema,
  WorkspaceUpdateBodySchema,
  workspaceCommandMetadata,
} from "@contextbase/contracts"
import { Schema } from "effect"

import type { CliCommandMetadata, CliCommandModule } from "../registry.js"

type WorkspaceCommandOptions = {
  fetch?: typeof fetch
}

type CliGlobalOptions = {
  apiUrl?: string
  compact?: boolean
  dryRun?: boolean
  json?: boolean
  token?: string
}

export function createWorkspacesCommand(options: WorkspaceCommandOptions = {}): CliCommandModule {
  return {
    metadata: toRegistryMetadata(requiredWorkspaceMetadata("workspaces.list")),
    register: (root, context) => {
      for (const metadata of workspaceCommandMetadata.slice(1)) {
        context.addCommandMetadata(toRegistryMetadata(metadata))
      }

      const workspaces = root.command("workspaces").description("Workspace commands")

      const list = workspaces.command("list").description("List workspaces")
      addJsonOption(list)
      addExamples(list, "workspaces.list")
      list.action(async () => {
        await runWorkspaceCommandRequest(
          list,
          options,
          { method: "GET", path: "/api/v1/workspaces" },
          (client) => client.list(),
        )
      })

      const create = workspaces.command("create").description("Create workspace")
      create.requiredOption("--workspace-name <name>", "Workspace name")
      create.requiredOption("--workspace-slug <slug>", "Workspace slug")
      addJsonOption(create)
      addExamples(create, "workspaces.create")
      create.action(async () => {
        const opts = create.opts() as { workspaceName?: string; workspaceSlug?: string }
        const body = decodeContract(WorkspaceCreateBodySchema, {
          workspaceName: opts.workspaceName,
          workspaceSlug: opts.workspaceSlug,
        })
        await runWorkspaceCommandRequest(
          create,
          options,
          { body, method: "POST", path: "/api/v1/workspaces" },
          (client) => client.create(body),
        )
      })

      const get = workspaces
        .command("get")
        .description("Get workspace")
        .argument("<workspaceIdOrSlug>")
      addJsonOption(get)
      addExamples(get, "workspaces.get")
      get.action(async (workspaceIdOrSlug: string) => {
        const params = decodeContract(WorkspaceIdOrSlugParamsSchema, { workspaceIdOrSlug })
        await runWorkspaceCommandRequest(
          get,
          options,
          { method: "GET", path: `/api/v1/workspaces/${params.workspaceIdOrSlug}` },
          (client) => client.get(params.workspaceIdOrSlug),
        )
      })

      const update = workspaces
        .command("update")
        .description("Update workspace")
        .argument("<workspaceIdOrSlug>")
      update.requiredOption("--workspace-name <name>", "Workspace name")
      addJsonOption(update)
      addExamples(update, "workspaces.update")
      update.action(async (workspaceIdOrSlug: string) => {
        const params = decodeContract(WorkspaceIdOrSlugParamsSchema, { workspaceIdOrSlug })
        const body = decodeContract(WorkspaceUpdateBodySchema, update.opts())
        await runWorkspaceCommandRequest(
          update,
          options,
          { body, method: "PATCH", path: `/api/v1/workspaces/${params.workspaceIdOrSlug}` },
          (client) => client.update(params.workspaceIdOrSlug, body),
        )
      })

      const archive = workspaces
        .command("archive")
        .description("Archive workspace")
        .argument("<workspaceIdOrSlug>")
      addJsonOption(archive)
      addExamples(archive, "workspaces.archive")
      archive.action(async (workspaceIdOrSlug: string) => {
        const params = decodeContract(WorkspaceIdOrSlugParamsSchema, { workspaceIdOrSlug })
        await runWorkspaceCommandRequest(
          archive,
          options,
          {
            method: "POST",
            path: `/api/v1/workspaces/${params.workspaceIdOrSlug}/archive`,
          },
          (client) => client.archive(params.workspaceIdOrSlug),
        )
      })

      const reactivate = workspaces
        .command("reactivate")
        .description("Reactivate workspace")
        .argument("<workspaceIdOrSlug>")
      addJsonOption(reactivate)
      addExamples(reactivate, "workspaces.reactivate")
      reactivate.action(async (workspaceIdOrSlug: string) => {
        const params = decodeContract(WorkspaceIdOrSlugParamsSchema, { workspaceIdOrSlug })
        await runWorkspaceCommandRequest(
          reactivate,
          options,
          {
            method: "POST",
            path: `/api/v1/workspaces/${params.workspaceIdOrSlug}/reactivate`,
          },
          (client) => client.reactivate(params.workspaceIdOrSlug),
        )
      })

      const rename = workspaces
        .command("rename-slug")
        .description("Rename workspace slug")
        .argument("<workspaceIdOrSlug>")
      rename.requiredOption("--new-slug <slug>", "New workspace slug")
      addJsonOption(rename)
      addExamples(rename, "workspaces.rename-slug")
      rename.action(async (workspaceIdOrSlug: string) => {
        const params = decodeContract(WorkspaceIdOrSlugParamsSchema, { workspaceIdOrSlug })
        const body = decodeContract(WorkspaceRenameSlugBodySchema, rename.opts())
        await runWorkspaceCommandRequest(
          rename,
          options,
          {
            body,
            method: "POST",
            path: `/api/v1/workspaces/${params.workspaceIdOrSlug}/rename-slug`,
          },
          (client) => client.renameSlug(params.workspaceIdOrSlug, body.newSlug),
        )
      })
    },
  }
}

function addJsonOption(command: { option: (flags: string, description?: string) => unknown }) {
  command.option("--json", "Output JSON")
}

function addExamples(
  command: { addHelpText: (position: "after", text: string) => unknown },
  id: string,
) {
  const metadata = workspaceCommandMetadata.find((item) => item.id === id)
  if (!metadata?.examples.length) return
  command.addHelpText(
    "after",
    `\nExamples:\n${metadata.examples.map((example) => `  ${example}`).join("\n")}`,
  )
}

function requiredWorkspaceMetadata(id: string) {
  const metadata = workspaceCommandMetadata.find((item) => item.id === id)
  if (!metadata) throw new Error(`Missing workspace command metadata: ${id}`)
  return metadata
}

function toRegistryMetadata(
  metadata: (typeof workspaceCommandMetadata)[number],
): CliCommandMetadata {
  return {
    ...metadata,
    arguments: metadata.arguments.map((argument) => ({ ...argument })),
    examples: [...metadata.examples],
    options: metadata.options.map((option) => {
      const base = {
        description: option.description,
        name: option.name,
        repeatable: option.repeatable,
        required: option.required,
        type: option.type,
      }
      return option.values ? { ...base, values: [...option.values] } : base
    }),
    output: { ...metadata.output },
    path: [...metadata.path],
  }
}

async function runWorkspaceCommandRequest<T>(
  command: {
    configureOutput: () => { writeOut?: (message: string) => void }
    optsWithGlobals: () => unknown
  },
  options: WorkspaceCommandOptions,
  request: { body?: unknown; method: string; path: string },
  run: (client: ReturnType<typeof createWorkspaceClient>) => Promise<T>,
) {
  const globals = command.optsWithGlobals() as CliGlobalOptions
  if (globals.dryRun) {
    writeJson(command, { data: request, ok: true }, globals)
    return
  }

  writeJson(command, await run(createConfiguredWorkspaceClient(globals, options)), globals)
}

function createConfiguredWorkspaceClient(
  globals: CliGlobalOptions,
  options: WorkspaceCommandOptions,
) {
  const token = globals.token ?? process.env.CONTEXTBASE_API_TOKEN
  return createWorkspaceClient(
    createApiClient({
      baseUrl: globals.apiUrl ?? process.env.CONTEXTBASE_API_URL ?? "http://127.0.0.1:3017",
      ...(options.fetch ? { fetch: options.fetch } : {}),
      ...(token ? { token } : {}),
    }),
  )
}

function decodeContract<T>(schema: Schema.Schema<T>, value: unknown): T {
  return Schema.decodeUnknownSync(schema)(value)
}

function writeJson(
  command: { configureOutput: () => { writeOut?: (message: string) => void } },
  value: unknown,
  options: CliGlobalOptions,
) {
  const indent = options.compact ? 0 : 2
  command.configureOutput().writeOut?.(`${JSON.stringify(value, null, indent)}\n`)
}

export type WorkspaceCommandArgs =
  | {
      command: "archive"
      json: boolean
      workspaceIdOrSlug: string
    }
  | {
      command: "create"
      json: boolean
      workspaceName: string
      workspaceSlug: string
    }
  | {
      command: "get"
      json: boolean
      workspaceIdOrSlug: string
    }
  | {
      command: "list"
      json: boolean
    }
  | {
      command: "reactivate"
      json: boolean
      workspaceIdOrSlug: string
    }
  | {
      command: "rename-slug"
      json: boolean
      newSlug: string
      workspaceIdOrSlug: string
    }
  | {
      command: "update"
      json: boolean
      workspaceIdOrSlug: string
      workspaceName: string
    }

export function parseWorkspaceArgs(args: string[]): WorkspaceCommandArgs {
  const [command, ...rest] = args.filter((arg) => arg !== "--")
  const json = rest.includes("--json")

  if (command === "list") {
    return {
      command,
      json,
    }
  }

  if (command === "get") {
    return {
      command,
      json,
      workspaceIdOrSlug: readPositional(rest, "workspace"),
    }
  }

  if (command === "update") {
    return {
      command,
      json,
      workspaceIdOrSlug: readPositional(rest, "workspace"),
      workspaceName: readFlag(rest, "--workspace-name"),
    }
  }

  if (command === "archive" || command === "reactivate") {
    return {
      command,
      json,
      workspaceIdOrSlug: readPositional(rest, "workspace"),
    }
  }

  if (command === "rename-slug") {
    return {
      command,
      json,
      newSlug: readFlag(rest, "--new-slug"),
      workspaceIdOrSlug: readPositional(rest, "workspace"),
    }
  }

  if (command !== "create") {
    throw new Error("Usage: contextbase workspaces <list|create|get|update|archive|reactivate>")
  }

  return {
    command,
    json,
    workspaceName: readFlag(rest, "--workspace-name"),
    workspaceSlug: readFlag(rest, "--workspace-slug"),
  }
}

export async function runWorkspaceCommand(args: string[]) {
  const parsed = parseWorkspaceArgs(args)
  const token = process.env.CONTEXTBASE_API_TOKEN
  const client = createWorkspaceClient(
    createApiClient({
      baseUrl: process.env.CONTEXTBASE_API_URL ?? "http://127.0.0.1:3017",
      ...(token ? { token } : {}),
    }),
  )

  const result = await runParsedWorkspaceCommand(client, parsed)

  if (parsed.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(JSON.stringify(result))
  }
}

async function runParsedWorkspaceCommand(
  client: ReturnType<typeof createWorkspaceClient>,
  parsed: WorkspaceCommandArgs,
) {
  if (parsed.command === "list") {
    return client.list()
  }

  if (parsed.command === "get") {
    return client.get(parsed.workspaceIdOrSlug)
  }

  if (parsed.command === "update") {
    return client.update(parsed.workspaceIdOrSlug, {
      workspaceName: parsed.workspaceName,
    })
  }

  if (parsed.command === "archive") {
    return client.archive(parsed.workspaceIdOrSlug)
  }

  if (parsed.command === "reactivate") {
    return client.reactivate(parsed.workspaceIdOrSlug)
  }

  if (parsed.command === "rename-slug") {
    return client.renameSlug(parsed.workspaceIdOrSlug, parsed.newSlug)
  }

  return client.create({
    workspaceName: parsed.workspaceName,
    workspaceSlug: parsed.workspaceSlug,
  })
}

function readFlag(args: string[], flag: string) {
  const index = args.indexOf(flag)
  const value = args[index + 1]

  if (index < 0 || !value) {
    throw new Error(`Missing ${flag}`)
  }

  return value
}

function readPositional(args: string[], label: string) {
  const value = args.find((arg) => !arg.startsWith("--") && arg !== "true" && arg !== "false")

  if (!value) {
    throw new Error(`Missing ${label}`)
  }

  return value
}

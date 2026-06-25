import { createApiClient } from "@contextbase/api-client"
import { createWorkspaceMemberClient } from "@contextbase/api-client/domains/workspace-members"
import {
  WorkspaceMemberIdParamsSchema,
  WorkspaceMemberUpdateBodySchema,
  workspaceMemberCommandMetadata,
} from "@contextbase/contracts"
import { Schema } from "effect"

import type { CliCommandMetadata, CliCommandModule } from "../registry.js"

type MemberCommandOptions = {
  fetch?: typeof fetch
}

type CliGlobalOptions = {
  apiUrl?: string
  compact?: boolean
  dryRun?: boolean
  json?: boolean
  token?: string
}

export function createMembersCommand(options: MemberCommandOptions = {}): CliCommandModule {
  return {
    metadata: toRegistryMetadata(requiredMemberMetadata("members.list")),
    register: (root, context) => {
      for (const metadata of workspaceMemberCommandMetadata.slice(1)) {
        context.addCommandMetadata(toRegistryMetadata(metadata))
      }

      const members = root.command("members").description("Workspace member commands")

      const list = members.command("list").description("List workspace members")
      addJsonOption(list)
      addExamples(list, "members.list")
      list.action(async () => {
        await runMemberCommandRequest(
          list,
          options,
          { method: "GET", path: "/api/v1/workspace-members" },
          (client) => client.list(),
        )
      })

      const update = members
        .command("update")
        .description("Update workspace member")
        .argument("<membershipId>")
      update.requiredOption("--role <role>", "Workspace member role")
      addJsonOption(update)
      addExamples(update, "members.update")
      update.action(async (membershipId: string) => {
        const params = decodeContract(WorkspaceMemberIdParamsSchema, { membershipId })
        const body = decodeContract(WorkspaceMemberUpdateBodySchema, update.opts())
        await runMemberCommandRequest(
          update,
          options,
          { body, method: "PATCH", path: `/api/v1/workspace-members/${params.membershipId}` },
          (client) => client.update(params.membershipId, body),
        )
      })

      const disable = members
        .command("disable")
        .description("Disable workspace member")
        .argument("<membershipId>")
      addJsonOption(disable)
      addExamples(disable, "members.disable")
      disable.action(async (membershipId: string) => {
        const params = decodeContract(WorkspaceMemberIdParamsSchema, { membershipId })
        await runMemberCommandRequest(
          disable,
          options,
          { method: "POST", path: `/api/v1/workspace-members/${params.membershipId}/disable` },
          (client) => client.disable(params.membershipId),
        )
      })

      const reactivate = members
        .command("reactivate")
        .description("Reactivate workspace member")
        .argument("<membershipId>")
      addJsonOption(reactivate)
      addExamples(reactivate, "members.reactivate")
      reactivate.action(async (membershipId: string) => {
        const params = decodeContract(WorkspaceMemberIdParamsSchema, { membershipId })
        await runMemberCommandRequest(
          reactivate,
          options,
          { method: "POST", path: `/api/v1/workspace-members/${params.membershipId}/reactivate` },
          (client) => client.reactivate(params.membershipId),
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
  const metadata = workspaceMemberCommandMetadata.find((item) => item.id === id)
  if (!metadata?.examples.length) return
  command.addHelpText(
    "after",
    `\nExamples:\n${metadata.examples.map((example) => `  ${example}`).join("\n")}`,
  )
}

function requiredMemberMetadata(id: string) {
  const metadata = workspaceMemberCommandMetadata.find((item) => item.id === id)
  if (!metadata) throw new Error(`Missing member command metadata: ${id}`)
  return metadata
}

function toRegistryMetadata(
  metadata: (typeof workspaceMemberCommandMetadata)[number],
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

async function runMemberCommandRequest<T>(
  command: {
    configureOutput: () => { writeOut?: (message: string) => void }
    optsWithGlobals: () => unknown
  },
  options: MemberCommandOptions,
  request: { body?: unknown; method: string; path: string },
  run: (client: ReturnType<typeof createWorkspaceMemberClient>) => Promise<T>,
) {
  const globals = command.optsWithGlobals() as CliGlobalOptions
  if (globals.dryRun) {
    writeJson(command, { data: request, ok: true }, globals)
    return
  }

  writeJson(command, await run(createConfiguredMemberClient(globals, options)), globals)
}

function createConfiguredMemberClient(globals: CliGlobalOptions, options: MemberCommandOptions) {
  const token = globals.token ?? process.env.CONTEXTBASE_API_TOKEN
  return createWorkspaceMemberClient(
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

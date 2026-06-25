import { createApiClient } from "@contextbase/api-client"
import { createWorkspaceInvitationClient } from "@contextbase/api-client/domains/invitations"
import {
  type WorkspaceInvitationCreateBody,
  WorkspaceInvitationCreateBodySchema,
  WorkspaceInvitationIdParamsSchema,
  workspaceInvitationCommandMetadata,
} from "@contextbase/contracts"
import { Schema } from "effect"

import type { CliCommandMetadata, CliCommandModule } from "../registry.js"

type InvitationCommandOptions = {
  fetch?: typeof fetch
}

type CliGlobalOptions = {
  apiUrl?: string
  compact?: boolean
  dryRun?: boolean
  json?: boolean
  token?: string
}

export function createInvitationsCommand(options: InvitationCommandOptions = {}): CliCommandModule {
  return {
    metadata: toRegistryMetadata(requiredInvitationMetadata("invitations.list")),
    register: (root, context) => {
      for (const metadata of workspaceInvitationCommandMetadata.slice(1)) {
        context.addCommandMetadata(toRegistryMetadata(metadata))
      }

      const invitations = root.command("invitations").description("Workspace invitation commands")

      const list = invitations.command("list").description("List workspace invitations")
      addJsonOption(list)
      addExamples(list, "invitations.list")
      list.action(async () => {
        await runInvitationCommandRequest(
          list,
          options,
          { method: "GET", path: "/api/v1/workspace-invitations" },
          (client) => client.list(),
        )
      })

      const create = invitations.command("create").description("Create workspace invitation")
      create.requiredOption("--email <email>", "Invitee email address")
      create.option("--role <role>", "Workspace role")
      addJsonOption(create)
      addExamples(create, "invitations.create")
      create.action(async () => {
        const body = decodeContract(
          WorkspaceInvitationCreateBodySchema,
          optionalObject(create.opts()),
        ) as WorkspaceInvitationCreateBody
        await runInvitationCommandRequest(
          create,
          options,
          { body, method: "POST", path: "/api/v1/workspace-invitations" },
          (client) => client.create(body),
        )
      })

      const revoke = invitations
        .command("revoke")
        .description("Revoke workspace invitation")
        .argument("<invitationId>")
      addJsonOption(revoke)
      addExamples(revoke, "invitations.revoke")
      revoke.action(async (invitationId: string) => {
        const params = decodeContract(WorkspaceInvitationIdParamsSchema, { invitationId })
        await runInvitationCommandRequest(
          revoke,
          options,
          {
            method: "POST",
            path: `/api/v1/workspace-invitations/${params.invitationId}/revoke`,
          },
          (client) => client.revoke(params.invitationId),
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
  const metadata = workspaceInvitationCommandMetadata.find((item) => item.id === id)
  if (!metadata?.examples.length) return
  command.addHelpText(
    "after",
    `\nExamples:\n${metadata.examples.map((example) => `  ${example}`).join("\n")}`,
  )
}

function requiredInvitationMetadata(id: string) {
  const metadata = workspaceInvitationCommandMetadata.find((item) => item.id === id)
  if (!metadata) throw new Error(`Missing invitation command metadata: ${id}`)
  return metadata
}

function toRegistryMetadata(
  metadata: (typeof workspaceInvitationCommandMetadata)[number],
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

async function runInvitationCommandRequest<T>(
  command: {
    configureOutput: () => { writeOut?: (message: string) => void }
    optsWithGlobals: () => unknown
  },
  options: InvitationCommandOptions,
  request: { body?: unknown; method: string; path: string },
  run: (client: ReturnType<typeof createWorkspaceInvitationClient>) => Promise<T>,
) {
  const globals = command.optsWithGlobals() as CliGlobalOptions
  if (globals.dryRun) {
    writeJson(command, { data: request, ok: true }, globals)
    return
  }

  writeJson(command, await run(createConfiguredInvitationClient(globals, options)), globals)
}

function createConfiguredInvitationClient(
  globals: CliGlobalOptions,
  options: InvitationCommandOptions,
) {
  const token = globals.token ?? process.env.CONTEXTBASE_API_TOKEN
  return createWorkspaceInvitationClient(
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

function optionalObject(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
}

function writeJson(
  command: { configureOutput: () => { writeOut?: (message: string) => void } },
  value: unknown,
  options: CliGlobalOptions,
) {
  const indent = options.compact ? 0 : 2
  command.configureOutput().writeOut?.(`${JSON.stringify(value, null, indent)}\n`)
}

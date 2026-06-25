import { resolveConfiguredAccessToken } from "./auth-config.js"
import { createAuthCommand } from "./commands/auth.js"
import { createDoctorCommand } from "./commands/doctor.js"
import { createFilesCommand } from "./commands/files.js"
import { createInvitationsCommand } from "./commands/invitations.js"
import { createMembersCommand } from "./commands/members.js"
import { createWorkspacesCommand } from "./commands/workspaces.js"
import { commandListCommand } from "./commands.js"
import { createCliRegistrationContext, registerCommands } from "./registry.js"
import { createRootCommand } from "./root.js"

type PublicCliOptions = {
  fetch?: typeof fetch
  output?: CliOutputConfiguration
}

type CliOutputConfiguration = {
  writeErr?: (message: string) => void
  writeOut?: (message: string) => void
}

export function createPublicCliCommand(options: PublicCliOptions = {}) {
  const root = createRootCommand()
  const context = createCliRegistrationContext()

  installOAuthConfigHook(root, options.fetch)

  if (options.output) {
    root.configureOutput(options.output)
  }

  registerCommands(
    root,
    [
      commandListCommand,
      createWorkspacesCommand(options),
      createInvitationsCommand(options),
      createMembersCommand(options),
      createFilesCommand(options),
      createDoctorCommand(options),
      createAuthCommand(options),
    ],
    context,
  )

  return root
}

function installOAuthConfigHook(
  root: ReturnType<typeof createRootCommand>,
  fetchImpl?: typeof fetch,
) {
  root.hook("preAction", async (command, actionCommand) => {
    if (isAuthCommand(actionCommand ?? command)) return

    const globals = command.optsWithGlobals() as { apiUrl?: string; token?: string }
    if (globals.token || process.env.CONTEXTBASE_API_TOKEN) return

    const apiUrl = globals.apiUrl ?? process.env.CONTEXTBASE_API_URL ?? "http://127.0.0.1:3017"
    const token = await resolveConfiguredAccessToken({
      apiUrl,
      fetch: fetchImpl ?? fetch,
      resource: resolveApiResourceUrl(apiUrl),
    })
    if (token) process.env.CONTEXTBASE_API_TOKEN = token
  })
}

type CommandNode = {
  name: () => string
  parent?: CommandNode | null
}

function isAuthCommand(command: CommandNode) {
  for (let current: CommandNode | null | undefined = command; current; current = current.parent) {
    if (current.name() === "auth") return true
  }
  return false
}

function resolveApiResourceUrl(apiUrl: string) {
  return new URL("/api/v1", apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`).toString()
}

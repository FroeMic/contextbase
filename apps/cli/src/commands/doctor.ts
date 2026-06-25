import { ApiClientError, createApiClient } from "@contextbase/api-client"

import type { CliCommandModule } from "../registry.js"

type UtilityCommandOptions = {
  fetch?: typeof fetch
}

type CliGlobalOptions = {
  apiUrl?: string
  compact?: boolean
  dryRun?: boolean
  json?: boolean
  token?: string
}

export function createDoctorCommand(options: UtilityCommandOptions = {}): CliCommandModule {
  return {
    metadata: {
      arguments: [],
      description: "Check API reachability, token presence, and authenticated probe status.",
      examples: ["contextbase doctor --json"],
      id: "doctor",
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
      path: ["doctor"],
      summary: "Check local CLI configuration",
    },
    register: (root) => {
      const doctor = root
        .command("doctor")
        .description("Check local CLI configuration")
        .option("--json", "Output JSON")
        .action(async () => {
          const globals = doctor.optsWithGlobals() as CliGlobalOptions
          const apiUrl = resolveApiUrl(globals)
          const token = resolveToken(globals)

          if (globals.dryRun) {
            writeJson(
              doctor,
              {
                ok: true,
                data: {
                  requests: [
                    { method: "GET", path: "/healthz" },
                    { method: "GET", path: "/api/v1/auth/probe" },
                  ],
                },
              },
              globals,
            )
            return
          }

          const client = createApiClient({
            baseUrl: apiUrl,
            ...(options.fetch ? { fetch: options.fetch } : {}),
            ...(token ? { token } : {}),
          })

          const [health, auth] = await Promise.all([
            probe(() => client.get("/healthz")),
            probe(() => client.get("/api/v1/auth/probe")),
          ])

          writeJson(
            doctor,
            {
              ok: true,
              data: {
                apiUrl,
                auth,
                health,
                token: { present: Boolean(token) },
              },
            },
            globals,
          )
        })
    },
  }
}

export const doctorCommand = createDoctorCommand()

async function probe(request: () => Promise<unknown>) {
  try {
    await request()
    return { ok: true }
  } catch (error) {
    if (error instanceof ApiClientError) {
      return {
        ok: false,
        status: error.status,
      }
    }
    return { ok: false }
  }
}

function resolveApiUrl(options: CliGlobalOptions) {
  return options.apiUrl ?? process.env.CONTEXTBASE_API_URL ?? "http://127.0.0.1:3017"
}

function resolveToken(options: CliGlobalOptions) {
  return options.token ?? process.env.CONTEXTBASE_API_TOKEN
}

function writeJson(
  command: { configureOutput: () => { writeOut?: (message: string) => void } },
  value: unknown,
  options: CliGlobalOptions,
) {
  const indent = options.compact ? 0 : 2
  command.configureOutput().writeOut?.(`${JSON.stringify(value, null, indent)}\n`)
}

import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from "node:http"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import type { Plugin } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({
      server: {
        entry: "./src/server-entry.ts",
      },
    }),
    verticalApiDevMiddleware(),
    viteReact(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
  ],
  server: {
    allowedHosts: ["host.docker.internal", "web", configuredHmrHost(), ...configuredAllowedHosts()],
    hmr: {
      clientPort: 443,
      host: configuredHmrHost(),
      protocol: "wss",
    },
    port: 4017,
  },
  test: {
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
})

function verticalApiDevMiddleware(): Plugin {
  return {
    name: "vertical-api-dev-middleware",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (incoming, outgoing, next) => {
        const pathname = new URL(incoming.url ?? "/", "http://localhost").pathname
        if (
          !(
            pathname.startsWith("/api/") ||
            pathname.startsWith("/ingest/") ||
            pathname.startsWith("/public/avatars/")
          )
        ) {
          next()
          return
        }

        try {
          const mod = await server.ssrLoadModule("/src/server-entry.ts")
          const response = await mod.handleFetchRequest(await toFetchRequest(incoming))
          await writeResponse(outgoing, response)
        } catch (error) {
          console.error("web API request failed", error)
          outgoing.writeHead(500, { "content-type": "application/json; charset=utf-8" })
          outgoing.end(
            JSON.stringify({
              error: {
                code: "internal_error",
                details: {},
                message: "Unexpected server error.",
              },
              ok: false,
            }),
          )
        }
      })
    },
  }
}

export async function toFetchRequest(incoming: IncomingMessage) {
  const forwardedProto = forwardedHeaderValue(incoming.headers["x-forwarded-proto"])
  const forwardedHost = forwardedHeaderValue(incoming.headers["x-forwarded-host"])
  const protocol = forwardedProto ?? "http"
  const host = forwardedHost ?? incoming.headers.host ?? "127.0.0.1:4017"
  const origin = `${protocol}://${host}`
  const url = new URL(incoming.url ?? "/", origin)
  const headers = new Headers()
  for (const [key, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item)
    } else if (value !== undefined) {
      headers.set(key, value)
    }
  }

  const body =
    incoming.method === "GET" || incoming.method === "HEAD"
      ? undefined
      : await readIncomingBody(incoming)

  return new Request(url, {
    body,
    duplex: "half",
    headers,
    method: incoming.method,
  } as RequestInit)
}

function configuredAllowedHosts() {
  return (process.env.WEB_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter((host) => host.length > 0)
}

function configuredHmrHost() {
  return (
    process.env.WEB_HMR_HOST ??
    process.env.LOCAL_APP_HOST ??
    configuredAllowedHosts()[0] ??
    "localhost"
  )
}

function forwardedHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

async function readIncomingBody(incoming: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of incoming) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

async function writeResponse(outgoing: ServerResponse, response: Response) {
  outgoing.writeHead(response.status, responseHeadersForNode(response.headers))
  if (!response.body) {
    outgoing.end()
    return
  }
  outgoing.end(Buffer.from(await response.arrayBuffer()))
}

export function responseHeadersForNode(headers: Headers): OutgoingHttpHeaders {
  const nodeHeaders: OutgoingHttpHeaders = {}
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === "set-cookie") continue
    nodeHeaders[key] = value
  }

  const setCookies = headers.getSetCookie()
  if (setCookies.length > 0) {
    nodeHeaders["set-cookie"] = setCookies
  }

  return nodeHeaders
}

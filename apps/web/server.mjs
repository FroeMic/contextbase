import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { createServer } from "node:http"
import path from "node:path"
import { Readable } from "node:stream"
import { fileURLToPath } from "node:url"
import app from "./dist/server/server.js"
import {
  maybeHandleApiRequest,
  maybeHandleInfrastructureRequest,
} from "./dist/server-api/server-api.js"

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const clientDir = path.join(rootDir, "dist", "client")
const host = process.env.HOST ?? "0.0.0.0"
const port = Number.parseInt(process.env.PORT ?? "4017", 10)

const server = createServer(async (incoming, outgoing) => {
  try {
    const staticResponse = await maybeServeStatic(incoming.url ?? "/")
    if (staticResponse) {
      writeResponse(outgoing, staticResponse)
      return
    }

    const request = toFetchRequest(incoming)
    const infrastructureResponse = await maybeHandleInfrastructureRequest(request)
    if (infrastructureResponse) {
      writeResponse(outgoing, infrastructureResponse)
      return
    }

    const apiResponse = await maybeHandleApiRequest(request)
    if (apiResponse) {
      writeResponse(outgoing, apiResponse)
      return
    }

    const response = await app.fetch(request)
    writeResponse(outgoing, response)
  } catch (error) {
    console.error("web request failed", error)
    outgoing.writeHead(500, { "content-type": "text/plain; charset=utf-8" })
    outgoing.end("Internal Server Error")
  }
})

server.listen(port, host, () => {
  console.log(`web listening on http://${host}:${port}`)
})

async function maybeServeStatic(url) {
  const pathname = new URL(url, "http://localhost").pathname
  const candidate = path.normalize(path.join(clientDir, pathname))
  if (!candidate.startsWith(clientDir) || candidate === clientDir) return null

  try {
    const file = await stat(candidate)
    if (!file.isFile()) return null
    return new Response(Readable.toWeb(createReadStream(candidate)), {
      headers: {
        "cache-control": immutableStaticAsset(pathname)
          ? "public, max-age=31536000, immutable"
          : "public, max-age=60",
        "content-length": String(file.size),
        "content-type": contentTypeFor(candidate),
      },
    })
  } catch {
    return null
  }
}

function toFetchRequest(incoming) {
  const origin = `http://${incoming.headers.host ?? `${host}:${port}`}`
  const url = new URL(incoming.url ?? "/", origin)
  const headers = new Headers()
  for (const [key, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item)
    } else if (value !== undefined) {
      headers.set(key, value)
    }
  }

  return new Request(url, {
    body:
      incoming.method === "GET" || incoming.method === "HEAD"
        ? undefined
        : Readable.toWeb(incoming),
    duplex: "half",
    headers,
    method: incoming.method,
  })
}

function writeResponse(outgoing, response) {
  outgoing.writeHead(response.status, responseHeadersForNode(response.headers))
  if (!response.body) {
    outgoing.end()
    return
  }
  Readable.fromWeb(response.body).pipe(outgoing)
}

function responseHeadersForNode(headers) {
  const nodeHeaders = {}
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

function immutableStaticAsset(pathname) {
  return pathname.startsWith("/assets/")
}

function contentTypeFor(file) {
  if (file.endsWith(".css")) return "text/css; charset=utf-8"
  if (file.endsWith(".html")) return "text/html; charset=utf-8"
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8"
  if (file.endsWith(".json")) return "application/json; charset=utf-8"
  if (file.endsWith(".png")) return "image/png"
  if (file.endsWith(".svg")) return "image/svg+xml"
  if (file.endsWith(".webp")) return "image/webp"
  if (file.endsWith(".wasm")) return "application/wasm"
  return "application/octet-stream"
}

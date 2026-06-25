import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("production server API routing", () => {
  test("checks infrastructure and API handlers before falling through to the page app", () => {
    const source = readFileSync(join(process.cwd(), "server.mjs"), "utf8")
    const infrastructureDispatch =
      "const infrastructureResponse = await maybeHandleInfrastructureRequest(request)"
    const apiDispatch = "const apiResponse = await maybeHandleApiRequest(request)"
    const pageDispatch = "const response = await app.fetch(request)"

    expect(source).toContain('from "./dist/server-api/server-api.js"')
    expect(source).toContain(infrastructureDispatch)
    expect(source).toContain(apiDispatch)
    expect(source).toContain(pageDispatch)
    expect(source.indexOf(infrastructureDispatch)).toBeLessThan(source.indexOf(apiDispatch))
    expect(source.indexOf(apiDispatch)).toBeLessThan(source.indexOf(pageDispatch))
  })

  test("serves only built assets as immutable static assets", () => {
    const source = readFileSync(join(process.cwd(), "server.mjs"), "utf8")

    expect(source).toContain('pathname.startsWith("/assets/")')
    expect(source).not.toContain("/vertical-avatar.png")
    expect(source).toContain('file.endsWith(".png")')
    expect(source).toContain('return "image/png"')
  })
})

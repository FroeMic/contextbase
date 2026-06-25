import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("shared app query client router context", () => {
  test("router creates the app query client once and exposes it through context", () => {
    const routerSource = readFileSync(join(process.cwd(), "src/router.tsx"), "utf8")

    expect(routerSource).toContain("createAppQueryClient")
    expect(routerSource).toContain("const queryClient = createAppQueryClient()")
    expect(routerSource).toContain("context: {")
    expect(routerSource).toContain("queryClient,")
  })

  test("root route passes the router query client into AppProviders", () => {
    const rootSource = readFileSync(join(process.cwd(), "src/routes/__root.tsx"), "utf8")

    expect(rootSource).toContain("useRouter")
    expect(rootSource).toContain("router.options.context.queryClient")
    expect(rootSource).toContain("<AppProviders queryClient={queryClient}>")
  })

  test("app providers do not create a second query client", () => {
    const providersSource = readFileSync(
      join(process.cwd(), "src/app/providers/AppProviders.tsx"),
      "utf8",
    )

    expect(providersSource).toContain("queryClient: QueryClient")
    expect(providersSource).not.toContain("new QueryClient")
    expect(providersSource).not.toContain("useState(() =>")
  })
})

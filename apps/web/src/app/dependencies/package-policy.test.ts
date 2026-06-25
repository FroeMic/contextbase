import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}
const componentsJson = JSON.parse(readFileSync(join(process.cwd(), "components.json"), "utf8")) as {
  aliases: Record<string, string>
}
const pnpmWorkspaceYaml = readFileSync(join(process.cwd(), "../../pnpm-workspace.yaml"), "utf8")

describe("web dependency policy", () => {
  test("pins core frontend dependencies instead of using latest", () => {
    const allDependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
    const corePackages = Object.entries(allDependencies).filter(([name]) =>
      [
        "@rocicorp/zero",
        "@tanstack/react-query",
        "@tanstack/react-router",
        "@tanstack/react-start",
        "react",
        "react-dom",
      ].includes(name),
    )

    expect(corePackages).not.toEqual([])
    expect(corePackages.filter(([, version]) => version === "latest")).toEqual([])
  })

  test("pins all Tiptap packages to the same stable version", () => {
    const tiptapDependencies = Object.entries(packageJson.dependencies).filter(([name]) =>
      name.startsWith("@tiptap/"),
    )

    expect(tiptapDependencies).toEqual([
      ["@tiptap/core", "3.23.5"],
      ["@tiptap/extension-image", "3.23.5"],
      ["@tiptap/extension-link", "3.23.5"],
      ["@tiptap/extension-list", "3.23.5"],
      ["@tiptap/markdown", "3.23.5"],
      ["@tiptap/pm", "3.23.5"],
      ["@tiptap/react", "3.23.5"],
      ["@tiptap/starter-kit", "3.23.5"],
      ["@tiptap/static-renderer", "3.23.5"],
    ])
  })

  test("allows the current stable Tiptap release through the workspace release-age gate", () => {
    expect(pnpmWorkspaceYaml).toContain("minimumReleaseAge: 4320")
    expect(pnpmWorkspaceYaml).toContain('- "@tiptap/*"')
  })

  test("uses Base UI/shadcn primitives while allowing official datatable Radix internals", () => {
    const allowedDatatableRadixPackages = [
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tooltip",
    ]

    expect(packageJson.dependencies["@base-ui/react"]).toBeDefined()
    expect(packageJson.dependencies.sonner).toBeDefined()
    expect(
      Object.keys(packageJson.dependencies).filter((name) => name.startsWith("@radix-ui/")),
    ).toEqual(allowedDatatableRadixPackages)
  })

  test("configures shadcn output as shared UI primitives only", () => {
    expect(componentsJson.aliases.ui).toBe("src/shared/ui")
    expect(existsSync(join(process.cwd(), "src/shared/ui/button.tsx"))).toBe(true)
    expect(existsSync(join(process.cwd(), "src/shared/ui/dropdown-menu.tsx"))).toBe(true)
  })

  test("keeps product navigation out of shared primitives", () => {
    for (const legacySharedNavigationFile of [
      "src/shared/app-sidebar.tsx",
      "src/shared/nav-main.tsx",
      "src/shared/nav-projects.tsx",
      "src/shared/nav-secondary.tsx",
      "src/shared/nav-user.tsx",
    ]) {
      expect(existsSync(join(process.cwd(), legacySharedNavigationFile))).toBe(false)
    }
  })

  test("uses core subpath imports in bundled web runtime modules", () => {
    const rootCoreImports = listSourceFiles(join(process.cwd(), "src"))
      .filter((filePath) => !filePath.endsWith(".test.ts"))
      .filter((filePath) => !filePath.endsWith(".test.tsx"))
      .filter((filePath) =>
        /from\s+["']@contextbase\/core["']/.test(readFileSync(filePath, "utf8")),
      )
      .map((filePath) => filePath.slice(process.cwd().length + 1))

    expect(rootCoreImports).toEqual([])
  })

  test("keeps optional S3 storage out of the default server API bundle", () => {
    const browserFileRoutes = readFileSync(
      join(process.cwd(), "src/domains/files/server/browser-file-routes.ts"),
      "utf8",
    )

    expect(browserFileRoutes).not.toMatch(
      /from\s+["']@contextbase\/core\/domains\/files\/storage-s3["']/,
    )
  })
})

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) return listSourceFiles(path)
    if (path.endsWith(".ts") || path.endsWith(".tsx")) return [path]
    return []
  })
}

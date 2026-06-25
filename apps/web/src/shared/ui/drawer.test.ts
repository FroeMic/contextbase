import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

describe("drawer", () => {
  it("centers the bottom drawer handle with self alignment", () => {
    const source = readFileSync(join(process.cwd(), "src/shared/ui/drawer.tsx"), "utf8")

    expect(source).toContain("justify-self-center")
    expect(source).toContain("self-center")
    expect(source).not.toContain("mx-auto mt-4 hidden h-1.5 w-[100px]")
  })

  it("prevents drawer surfaces and chrome from expanding beyond the viewport", () => {
    const source = readFileSync(join(process.cwd(), "src/shared/ui/drawer.tsx"), "utf8")

    expect(source).toContain("fixed z-50 flex h-auto max-w-full min-w-0 flex-col")
    expect(source).toContain("flex max-w-full min-w-0 flex-col")
    expect(source).toContain("mt-auto flex max-w-full min-w-0 flex-col")
  })

  it("allows media viewers to suppress the bottom drawer handle", () => {
    const source = readFileSync(join(process.cwd(), "src/shared/ui/drawer.tsx"), "utf8")

    expect(source).toContain("showHandle = true")
    expect(source).toContain("{showHandle ? (")
    expect(source).toContain("Omit<React.ComponentProps<typeof DrawerPrimitive.Content>")
  })
})

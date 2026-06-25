import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("VirtualizedGrid overscan defaults", () => {
  test("uses a capped viewport overscan runway for smoother scrolling without excessive mounted cells", () => {
    const source = readFileSync(
      join(process.cwd(), "src/react-datatable/components/grid/VirtualizedGrid.tsx"),
      "utf8",
    )

    expect(source).toContain("Math.min(40, Math.max(32, Math.ceil(visibleRowEstimate * 1.5)))")
    expect(source).toContain("Math.min(24, Math.max(8, Math.ceil(visibleColumnEstimate * 1.5)))")
  })

  test("renders data row backgrounds behind cells for rounded row states", () => {
    const gridSource = readFileSync(
      join(process.cwd(), "src/react-datatable/components/grid/VirtualizedGrid.tsx"),
      "utf8",
    )
    const engineSource = readFileSync(
      join(process.cwd(), "src/react-datatable/components/grid/EngineGridRenderer.tsx"),
      "utf8",
    )
    const cellSource = readFileSync(
      join(process.cwd(), "src/react-datatable/components/grid/GridValueCell.tsx"),
      "utf8",
    )

    expect(gridSource).toContain("renderDataRowBackground")
    expect(engineSource).toContain("renderDataRowBackground")
    expect(gridSource).toContain("rounded-sm")
    expect(gridSource).toContain("data-[hovered=true]:bg-muted")
    expect(gridSource).toContain("data-[selected=true]:bg-accent")
    expect(cellSource).toContain("bg-transparent")
    expect(cellSource).not.toContain("data-[hovered=true]:bg-muted")
  })
})

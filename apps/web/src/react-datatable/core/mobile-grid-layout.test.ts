import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

function datatableSource(path: string) {
  return readFileSync(join(process.cwd(), "src/react-datatable", path), "utf8")
}

describe("datatable mobile grid layout", () => {
  test("uses taller mobile rows and headers without changing desktop defaults", () => {
    const bodySource = datatableSource("core/DatatableBody.tsx")
    const gridCellSource = datatableSource("components/grid/GridCell.tsx")
    const gridValueCellSource = datatableSource("components/grid/GridValueCell.tsx")
    const headerSource = datatableSource("components/grid/GridHeaderCell.tsx")

    expect(bodySource).toContain("useIsMobile")
    expect(bodySource).toContain("resolvedRowHeight")
    expect(bodySource).toContain("Math.max(rowHeight, 48)")
    expect(bodySource).toContain("resolvedHeaderHeight")
    expect(bodySource).toContain("Math.max(headerHeight, 48)")
    expect(gridCellSource).toContain("text-sm leading-5 md:text-xs md:leading-4")
    expect(gridCellSource).toContain("[&_*]:!text-sm md:[&_*]:!text-xs")
    expect(gridValueCellSource).toContain("text-sm leading-5 md:text-xs md:leading-4")
    expect(gridValueCellSource).toContain("[&_*]:!text-sm md:[&_*]:!text-xs")
    expect(headerSource).toContain("text-sm md:text-xs")
  })

  test("does not attach column reorder drag handlers on mobile", () => {
    const source = datatableSource("components/grid/VirtualizedGrid.tsx")

    expect(source).toContain("useIsMobile")
    expect(source).toContain("columnReorderingEnabled")
    expect(source).toContain("!isMobile")
    expect(source).toContain("columnReorderingEnabled ? (")
    expect(source).toContain("<SortableGridHeaderCell")
    expect(source).toContain("<GridHeaderCell")
  })
})

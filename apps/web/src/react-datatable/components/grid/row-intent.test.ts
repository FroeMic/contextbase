import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8")

describe("datatable row intent API", () => {
  test("exposes rowIntent as a generic datatable prop", () => {
    const propsSource = source("src/react-datatable/types/props.types.ts")
    const datatableSource = source("src/react-datatable/core/Datatable.tsx")
    const bodySource = source("src/react-datatable/core/DatatableBody.tsx")

    expect(propsSource).toContain("DatatableRowIntentConfig")
    expect(propsSource).toContain("rowIntent?: DatatableRowIntentConfig<TData>")
    expect(datatableSource).toContain("rowIntent")
    expect(bodySource).toContain("rowIntent={rowIntent}")
  })

  test("fires row intent from pointer hover and keyboard active-row movement only for data rows", () => {
    const gridSource = source("src/react-datatable/components/grid/VirtualizedGrid.tsx")

    expect(gridSource).toContain("rowIntent?: DatatableRowIntentConfig<TData>")
    expect(gridSource).toContain("triggerRowIntent")
    expect(gridSource).toContain('triggerRowIntent(rowId, "pointer")')
    expect(gridSource).toContain('intentTrigger: "keyboard"')
    expect(gridSource).toContain("displayRowModel.getDataRowById")
    expect(gridSource).not.toContain("renderableRows.map((row) => rowIntent")
  })
})

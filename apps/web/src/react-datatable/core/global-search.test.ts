import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("datatable local global search", () => {
  test("supports a row-level global search text accessor", () => {
    const propsSource = readFileSync(
      join(process.cwd(), "src/react-datatable/types/props.types.ts"),
      "utf8",
    )
    const datatableSource = readFileSync(
      join(process.cwd(), "src/react-datatable/core/Datatable.tsx"),
      "utf8",
    )
    const tableHookSource = readFileSync(
      join(process.cwd(), "src/react-datatable/core/use-datatable-table.ts"),
      "utf8",
    )

    expect(propsSource).toContain("getGlobalSearchText?: (row: TData) => string | null | undefined")
    expect(datatableSource).toContain("getGlobalSearchText={getGlobalSearchText}")
    expect(tableHookSource).toContain("getGlobalSearchText?.(row.original)")
  })
})

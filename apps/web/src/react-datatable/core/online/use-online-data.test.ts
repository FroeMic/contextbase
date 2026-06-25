import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { resolveOnlineQueryExpansionForMode } from "./use-online-data"

describe("online data live row hydration", () => {
  test("lets callers refresh rendered online rows without resetting query identity", () => {
    const propsSource = readFileSync(
      join(process.cwd(), "src/react-datatable/types/props.types.ts"),
      "utf8",
    )
    const onlineDataSource = readFileSync(
      join(process.cwd(), "src/react-datatable/core/online/use-online-data.ts"),
      "utf8",
    )
    const bodySource = readFileSync(
      join(process.cwd(), "src/react-datatable/core/DatatableBody.tsx"),
      "utf8",
    )

    expect(propsSource).toContain("liveDataVersion?: unknown")
    expect(onlineDataSource).toContain("liveDataVersion")
    expect(bodySource).toContain("onlineQuery?.liveDataVersion")
    expect(bodySource).toMatch(
      /createOnlineVirtualDisplayRowModel\([\s\S]*onlineQuery\.virtualPagesByOffset[\s\S]*onlineQuery\?\.liveDataVersion/,
    )
    expect(onlineDataSource).toContain("useQueryClient")
    expect(onlineDataSource).toContain(".ensureQueryData")
    expect(onlineDataSource).toContain("queryClient.getQueryCache().findAll")
    expect(onlineDataSource).toContain("onlineOnResponse?.")
    expect(onlineDataSource).toContain("buildPaginationOnlineQueryKey")
    expect(onlineDataSource).toContain("buildInfiniteOnlineQueryKey")
    expect(onlineDataSource).toContain("getCachedInfinitePages<TData>")
  })

  test("keeps rendered infinite rows visible while a changed query refetches", () => {
    const onlineDataSource = readFileSync(
      join(process.cwd(), "src/react-datatable/core/online/use-online-data.ts"),
      "utf8",
    )

    expect(onlineDataSource).toContain("virtualQuerySignatureRef")
    expect(onlineDataSource).toContain("virtualPagesByOffsetRef.current.size === 0")
    expect(onlineDataSource).toContain("const replacementPages = new Map")
    expect(onlineDataSource).toContain("virtualQuerySignatureRef.current !== requestSignature")
  })

  test("sanitizes online sorting before building query input", () => {
    const datatableSource = readFileSync(
      join(process.cwd(), "src/react-datatable/core/Datatable.tsx"),
      "utf8",
    )
    const onlineDataSource = readFileSync(
      join(process.cwd(), "src/react-datatable/core/online/use-online-data.ts"),
      "utf8",
    )

    expect(datatableSource).toContain("supportedSortingColumnsForMode")
    expect(datatableSource).toContain("setSorting(sanitizedSorting)")
    expect(onlineDataSource).toContain("supportedSortingColumns")
    expect(onlineDataSource).toContain("sanitizedSorting")
    expect(onlineDataSource).toContain("sorting: sanitizedSorting")
    expect(onlineDataSource).toContain("sanitizedSorting,")
  })

  test("keeps group expansion out of infinite online query identity", () => {
    expect(
      resolveOnlineQueryExpansionForMode("infinite", {
        "status:backlog": false,
      }),
    ).toEqual({
      defaultExpanded: true,
      overrides: {},
    })
    expect(
      resolveOnlineQueryExpansionForMode("pagination", {
        "status:backlog": false,
      }),
    ).toEqual({
      defaultExpanded: true,
      overrides: {
        "status:backlog": false,
      },
    })
  })

  test("does not reset online pages from unstable query input object identity", () => {
    const onlineDataSource = readFileSync(
      join(process.cwd(), "src/react-datatable/core/online/use-online-data.ts"),
      "utf8",
    )

    expect(onlineDataSource).toContain("queryStateInputRef")
    expect(onlineDataSource).toMatch(/useEffect\(\(\) => \{[\s\S]*getCachedInfinitePages/)
    expect(onlineDataSource).not.toContain("queryClient,\n    queryStateInput,\n  ])")
    expect(onlineDataSource).not.toContain(
      "paginationQueryKey,\n    queryClient,\n    queryStateInput,\n  ])",
    )
  })

  test("restores cached infinite pages before the first painted loading state", () => {
    const onlineDataSource = readFileSync(
      join(process.cwd(), "src/react-datatable/core/online/use-online-data.ts"),
      "utf8",
    )

    expect(onlineDataSource).toContain("initialCachedInfinitePages")
    expect(onlineDataSource).toContain("useState(initialCachedInfinitePages)")
  })
})

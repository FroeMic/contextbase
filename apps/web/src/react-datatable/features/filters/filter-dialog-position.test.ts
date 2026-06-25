import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import {
  DATATABLE_FILTER_DIALOG_CONTENT_CLASS_NAME,
  DATATABLE_FILTER_LARGE_DIALOG_CONTENT_CLASS_NAME,
} from "./filter-dialog-layout"

function datatableSource(path: string) {
  return readFileSync(join(process.cwd(), "src/react-datatable/features/filters", path), "utf8")
}

describe("datatable filter dialog positioning", () => {
  test("places title and custom date filter dialogs in the upper third while constraining height", () => {
    const filterModalSource = datatableSource("FilterEditorModal.tsx")
    const dateEditorSource = datatableSource("editors/DateFilterEditor.tsx")

    expect(DATATABLE_FILTER_DIALOG_CONTENT_CLASS_NAME).toContain("!fixed")
    expect(DATATABLE_FILTER_DIALOG_CONTENT_CLASS_NAME).toContain("!left-1/2")
    expect(DATATABLE_FILTER_DIALOG_CONTENT_CLASS_NAME).toContain("top-[35dvh]")
    expect(DATATABLE_FILTER_DIALOG_CONTENT_CLASS_NAME).toContain("translate-y-0")
    expect(DATATABLE_FILTER_DIALOG_CONTENT_CLASS_NAME).toContain("max-h-[calc(100dvh-5rem)]")
    expect(DATATABLE_FILTER_DIALOG_CONTENT_CLASS_NAME).toContain("overflow-y-auto")
    expect(DATATABLE_FILTER_LARGE_DIALOG_CONTENT_CLASS_NAME).toContain("!fixed")
    expect(DATATABLE_FILTER_LARGE_DIALOG_CONTENT_CLASS_NAME).toContain("!top-1/2")
    expect(DATATABLE_FILTER_LARGE_DIALOG_CONTENT_CLASS_NAME).toContain("!-translate-y-1/2")
    expect(DATATABLE_FILTER_LARGE_DIALOG_CONTENT_CLASS_NAME).toContain("max-h-[calc(100dvh-3rem)]")

    expect(filterModalSource).toContain("DATATABLE_FILTER_DIALOG_CONTENT_CLASS_NAME")
    expect(dateEditorSource).toContain("DATATABLE_FILTER_LARGE_DIALOG_CONTENT_CLASS_NAME")
  })
})

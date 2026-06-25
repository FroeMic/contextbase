import type { ReactNode } from "react"
import type {
  BooleanFilterOptions,
  FilterOption,
  FilterOptionValue,
  IdListFilterOptions,
  TextListFilterOptions,
} from "../../types/filter.types"

const DEFAULT_BOOLEAN_OPTIONS: [FilterOption<boolean>, FilterOption<boolean>] = [
  { value: true, label: "True" },
  { value: false, label: "False" },
]

export function normalizeTextListFilterOptions(
  columnId: string,
  filterOptions: unknown,
): FilterOption<string>[] {
  if (!filterOptions || typeof filterOptions !== "object") {
    console.warn(`[OptionListFilter] Invalid filterOptions for column "${columnId}"`)
    return []
  }

  const textListOptions = filterOptions as TextListFilterOptions
  if (!Array.isArray(textListOptions.options)) {
    console.warn(
      `[OptionListFilter] filterOptions.options is not an array for column "${columnId}"`,
    )
    return []
  }

  return textListOptions.options
    .map((option) => {
      if (typeof option === "string") {
        return { value: option, label: option }
      }

      if (typeof option === "object" && option !== null && "value" in option && "label" in option) {
        return { ...option, value: String(option.value), label: String(option.label) }
      }

      console.error(
        `[OptionListFilter] Invalid option format in column "${columnId}", skipping:`,
        option,
      )
      return null
    })
    .filter((option): option is FilterOption<string> => option !== null)
}

export function normalizeIdListFilterOptions(
  columnId: string,
  filterOptions: unknown,
): {
  options: FilterOption<string>[]
  isLoading: boolean
  emptyText: string
  searchPlaceholder: string
  renderOption?: (option: FilterOption<string>) => ReactNode
} {
  if (!filterOptions || typeof filterOptions !== "object") {
    console.warn(`[OptionListFilter] Invalid filterOptions for column "${columnId}"`)
    return {
      options: [],
      isLoading: false,
      emptyText: "No options available",
      searchPlaceholder: "Search options...",
    }
  }

  const idListOptions = filterOptions as IdListFilterOptions
  return {
    options: Array.isArray(idListOptions.options)
      ? idListOptions.options
          .map((option) => {
            if (!option || typeof option !== "object") {
              return null
            }

            return {
              value: String(option.value),
              label: String(option.label),
            }
          })
          .filter((option): option is FilterOption<string> => option !== null)
      : [],
    isLoading: idListOptions.isLoading === true,
    emptyText: idListOptions.emptyText ?? "No options available",
    searchPlaceholder: idListOptions.searchPlaceholder ?? "Search options...",
    renderOption: idListOptions.renderOption,
  }
}

export function normalizeBooleanFilterOptions(filterOptions: unknown): FilterOption<boolean>[] {
  if (!filterOptions || typeof filterOptions !== "object") {
    return DEFAULT_BOOLEAN_OPTIONS
  }

  const booleanFilterOptions = filterOptions as BooleanFilterOptions
  return booleanFilterOptions.options ?? DEFAULT_BOOLEAN_OPTIONS
}

export function summarizeOptionFilterValues<T extends FilterOptionValue>(
  options: readonly FilterOption<T>[],
  selectedValues: readonly T[],
) {
  if (selectedValues.length === 0) {
    return "empty"
  }

  const labelsByValue = new Map(options.map((option) => [String(option.value), option.label]))
  return selectedValues.map((value) => labelsByValue.get(String(value)) ?? String(value)).join(", ")
}

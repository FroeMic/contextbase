import { format, startOfWeek } from "date-fns"

export type GroupingDateGranularity = "day" | "week" | "month" | "year"

export interface GroupingBucket {
  id: string
  label: string
  min?: number
  max?: number
}

export type GroupingVariant =
  | {
      kind: "raw"
      emptyLabel?: string
    }
  | {
      kind: "date_trunc"
      granularity: GroupingDateGranularity
      emptyLabel?: string
    }
  | {
      kind: "bucket"
      buckets: GroupingBucket[]
      emptyLabel?: string
    }

export interface ColumnGroupingSpec {
  supportsOffline?: boolean
  supportsOnline?: boolean
  variants: Record<string, GroupingVariant>
  defaultVariant: string
}

export interface ResolvedGroupingValue {
  key: string
  label: string
  sortValue?: string | number
}

export type GroupingExecutionMode = "offline" | "online"

const DEFAULT_EMPTY_LABEL = "(Empty)"
const DEFAULT_OTHER_BUCKET_KEY = "__other__"
const DEFAULT_OTHER_BUCKET_LABEL = "Other"

export function isGroupingSupportedForMode(
  groupingSpec: ColumnGroupingSpec | undefined,
  mode: GroupingExecutionMode,
): boolean {
  if (!groupingSpec) {
    return true
  }

  if (mode === "offline") {
    return groupingSpec.supportsOffline !== false
  }

  return groupingSpec.supportsOnline !== false
}

export function resolveGroupingVariant(
  groupingSpec: ColumnGroupingSpec | undefined,
): GroupingVariant | undefined {
  if (!groupingSpec) {
    return undefined
  }

  return groupingSpec.variants[groupingSpec.defaultVariant]
}

export function resolveGroupingValues(
  rawValue: string | string[] | number | Date | null | undefined,
  groupingSpec: ColumnGroupingSpec | undefined,
): ResolvedGroupingValue[] {
  const variant = resolveGroupingVariant(groupingSpec)
  if (!variant) {
    return normalizeRawGroupingValue(rawValue, DEFAULT_EMPTY_LABEL)
  }

  switch (variant.kind) {
    case "raw":
      return normalizeRawGroupingValue(rawValue, variant.emptyLabel ?? DEFAULT_EMPTY_LABEL)
    case "date_trunc":
      return resolveDateGroupingValue(rawValue, variant)
    case "bucket":
      return resolveBucketGroupingValue(rawValue, variant)
  }
}

function normalizeRawGroupingValue(
  rawValue: string | string[] | number | Date | null | undefined,
  emptyLabel: string,
): ResolvedGroupingValue[] {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return [{ key: emptyLabel, label: emptyLabel }]
  }

  if (Array.isArray(rawValue)) {
    return rawValue.map((entry) => ({ key: String(entry), label: String(entry) }))
  }

  if (rawValue instanceof Date) {
    const isoValue = rawValue.toISOString()
    return [{ key: isoValue, label: isoValue, sortValue: rawValue.getTime() }]
  }

  if (typeof rawValue === "number") {
    return [{ key: String(rawValue), label: String(rawValue), sortValue: rawValue }]
  }

  return [{ key: rawValue, label: rawValue }]
}

function resolveDateGroupingValue(
  rawValue: string | string[] | number | Date | null | undefined,
  variant: Extract<GroupingVariant, { kind: "date_trunc" }>,
): ResolvedGroupingValue[] {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    const emptyLabel = variant.emptyLabel ?? DEFAULT_EMPTY_LABEL
    return [{ key: emptyLabel, label: emptyLabel }]
  }

  const parsedDate =
    rawValue instanceof Date
      ? rawValue
      : typeof rawValue === "string" || typeof rawValue === "number"
        ? new Date(rawValue)
        : null

  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    const emptyLabel = variant.emptyLabel ?? DEFAULT_EMPTY_LABEL
    return [{ key: emptyLabel, label: emptyLabel }]
  }

  switch (variant.granularity) {
    case "day":
      return [
        {
          key: format(parsedDate, "yyyy-MM-dd"),
          label: format(parsedDate, "MMM d, yyyy"),
          sortValue: parsedDate.getTime(),
        },
      ]
    case "week": {
      const weekStart = startOfWeek(parsedDate, { weekStartsOn: 1 })
      return [
        {
          key: format(weekStart, "yyyy-'W'II"),
          label: `Week of ${format(weekStart, "MMM d, yyyy")}`,
          sortValue: weekStart.getTime(),
        },
      ]
    }
    case "month":
      return [
        {
          key: format(parsedDate, "yyyy-MM"),
          label: format(parsedDate, "MMM yyyy"),
          sortValue: Number(format(parsedDate, "yyyyMM")),
        },
      ]
    case "year":
      return [
        {
          key: format(parsedDate, "yyyy"),
          label: format(parsedDate, "yyyy"),
          sortValue: parsedDate.getFullYear(),
        },
      ]
  }
}

function resolveBucketGroupingValue(
  rawValue: string | string[] | number | Date | null | undefined,
  variant: Extract<GroupingVariant, { kind: "bucket" }>,
): ResolvedGroupingValue[] {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    const emptyLabel = variant.emptyLabel ?? DEFAULT_EMPTY_LABEL
    return [{ key: emptyLabel, label: emptyLabel }]
  }

  const numericValue =
    typeof rawValue === "number"
      ? rawValue
      : typeof rawValue === "string"
        ? Number(rawValue)
        : rawValue instanceof Date
          ? rawValue.getTime()
          : NaN

  if (Number.isNaN(numericValue)) {
    const emptyLabel = variant.emptyLabel ?? DEFAULT_EMPTY_LABEL
    return [{ key: emptyLabel, label: emptyLabel }]
  }

  const bucket = variant.buckets.find(({ min, max }) => {
    const meetsMin = min === undefined || numericValue >= min
    const meetsMax = max === undefined || numericValue <= max
    return meetsMin && meetsMax
  })

  if (!bucket) {
    return [{ key: DEFAULT_OTHER_BUCKET_KEY, label: DEFAULT_OTHER_BUCKET_LABEL }]
  }

  return [{ key: bucket.id, label: bucket.label, sortValue: numericValue }]
}

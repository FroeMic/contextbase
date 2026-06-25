export type VerticalScrollSignatureMode = "cursor" | "local"

export type VerticalScrollQueryShape = {
  filters: unknown
  globalFilter: unknown
  grouping: unknown
  limit: number
}

export function buildVerticalScrollSignature({
  coreRowCount,
  mode,
  onlineQuerySignature,
  queryShape,
  rowCount,
  tableKey,
}: {
  coreRowCount: number
  mode: VerticalScrollSignatureMode
  onlineQuerySignature?: string
  queryShape: VerticalScrollQueryShape
  rowCount: number
  tableKey: string
}) {
  if (onlineQuerySignature) {
    return onlineQuerySignature
  }

  const signaturePayload: unknown[] = [
    tableKey,
    mode === "cursor" ? "cursor-vertical" : "local-vertical",
    // Exclude sorting so vertical position does not jump on sort-only changes.
    queryShape,
  ]

  if (mode === "local") {
    signaturePayload.push(rowCount, coreRowCount)
  }

  return JSON.stringify(signaturePayload)
}

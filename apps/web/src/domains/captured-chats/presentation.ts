import type { CapturedSession, CapturedSessionMessage } from "@contextbase/zero-schema"

export type CapturedTurnKind = "assistant" | "current_user" | "system"

export function capturedProviderLabel(providerKeyOrSource: string | null | undefined) {
  const source = providerKeyOrSource?.toLowerCase() ?? ""
  if (
    source.includes("chatgpt") ||
    source.includes("chat.openai.com") ||
    source.includes("chatgpt.com")
  ) {
    return "ChatGPT"
  }
  if (source.includes("claude") || source.includes("anthropic")) {
    return "Claude"
  }
  return "Assistant"
}

export function capturedSessionProviderLabel(
  session: Pick<CapturedSession, "metadataJson" | "sourceSessionKey" | "sourceUrl">,
) {
  const metadata = parseJsonObject(session.metadataJson)
  const providerKey =
    stringValue(metadata.providerKey) ??
    stringValue(objectValue(metadata.provider)?.providerKey) ??
    stringValue(objectValue(metadata.sessionCaptureObservation)?.providerKey)

  return capturedProviderLabel(providerKey ?? session.sourceUrl ?? session.sourceSessionKey)
}

export function capturedChatTitle(session: Pick<CapturedSession, "sourceSessionKey" | "title">) {
  const title = session.title?.trim()
  if (title) return title
  return "Untitled captured chat"
}

export function capturedTurnKind(role: string | null | undefined): CapturedTurnKind {
  if (role === "user") return "current_user"
  if (role === "assistant") return "assistant"
  return "system"
}

export function capturedTurnName(input: {
  providerLabel: string
  role: string | null | undefined
}) {
  if (input.role === "user") return "You"
  if (input.role === "assistant") return input.providerLabel
  if (input.role === "tool") return "Tool"
  if (input.role === "system") return "System"
  return "Captured"
}

export function capturedMessageText(
  message: Pick<CapturedSessionMessage, "contentJson" | "contentText">,
) {
  const contentText = message.contentText?.trim()
  if (contentText) return contentText

  const parsed = parseJsonObject(message.contentJson)
  return (
    stringValue(parsed.text) ??
    stringValue(parsed.content) ??
    stringValue(parsed.markdown) ??
    JSON.stringify(parsed)
  )
}

export function compareCapturedMessages(
  left: Pick<CapturedSessionMessage, "createdAt" | "id" | "sequenceNumber">,
  right: Pick<CapturedSessionMessage, "createdAt" | "id" | "sequenceNumber">,
) {
  const sequence = compareSequence(left.sequenceNumber, right.sequenceNumber)
  if (sequence !== 0) return sequence

  const createdAt = (left.createdAt ?? 0) - (right.createdAt ?? 0)
  if (createdAt !== 0) return createdAt

  return left.id.localeCompare(right.id)
}

export function dedupeCapturedMessages<
  T extends Pick<
    CapturedSessionMessage,
    "createdAt" | "id" | "sequenceNumber" | "sourceMessageKey"
  >,
>(messages: readonly T[]) {
  const seen = new Set<string>()
  const result: T[] = []

  for (const message of [...messages].sort(compareCapturedMessages)) {
    if (seen.has(message.sourceMessageKey)) continue
    seen.add(message.sourceMessageKey)
    result.push(message)
  }

  return result
}

export function orderedCapturedMessages<T extends CapturedSessionMessage>(messages: readonly T[]) {
  return dedupeCapturedMessages([...messages].sort(compareCapturedMessages))
}

export function formatCapturedTimestamp(value: number | null | undefined) {
  if (!value) return ""
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  })
}

export function formatCapturedDateTime(value: number | null | undefined) {
  if (!value) return "Not synced yet"
  return new Date(value).toLocaleString([], {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  })
}

export function capturedChatStatusLabel(
  session: Pick<CapturedSession, "metadataJson">,
  latestSyncEvent?: { status?: string | null } | null,
) {
  if (latestSyncEvent?.status === "failed" || latestSyncEvent?.status === "rejected") {
    return "Last sync failed"
  }

  const observation = capturedObservationMetadata(session.metadataJson)
  if (observation.oldestBoundarySeen === true && observation.latestBoundarySeen === true) {
    return "Complete mirror"
  }

  return "Partial mirror"
}

export function capturedObservationMetadata(metadataJson: string | null | undefined) {
  const metadata = parseJsonObject(metadataJson)
  const observation =
    objectValue(metadata.sessionCaptureObservation) ??
    objectValue(metadata.coverage) ??
    objectValue(metadata.observation) ??
    metadata

  return {
    latestBoundarySeen: booleanValue(observation.latestBoundarySeen),
    oldestBoundarySeen: booleanValue(observation.oldestBoundarySeen),
    observedAt: stringValue(observation.observedAt),
    visibleMessageCount: numberValue(observation.visibleMessageCount),
  }
}

function compareSequence(left: string, right: string) {
  const leftNumber = Number(left)
  const rightNumber = Number(right)

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber
  }

  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {}

  try {
    const parsed = JSON.parse(value)
    return objectValue(parsed) ?? {}
  } catch {
    return {}
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

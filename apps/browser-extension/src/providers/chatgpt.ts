import type { CapturedMessageRole, SessionCaptureManualSyncBody } from "@contextbase/contracts"

import type { ExtractedMessage, ExtractedSession, ProviderMatch } from "./types"

export const CHATGPT_PARSER_VERSION = "chatgpt-dom@0.1.0"

const CHATGPT_ORIGINS = new Set(["https://chatgpt.com", "https://chat.openai.com"])

export function detectChatGptProvider(url: URL): ProviderMatch | null {
  if (!CHATGPT_ORIGINS.has(url.origin)) return null
  return { displayName: "ChatGPT", providerKey: "chatgpt" }
}

export function extractChatGptSession(document: Document, url: URL): ExtractedSession {
  const provider = detectChatGptProvider(url)
  if (!provider) {
    throw new Error("Unsupported ChatGPT URL")
  }

  const title = findTitle(document) ?? "Untitled ChatGPT session"
  const sourceSessionId = extractSessionId(url)
  const messages = extractMessages(document)
  const sourceUrl = normalizeUrl(url)

  return {
    messages,
    parserVersion: CHATGPT_PARSER_VERSION,
    provider,
    session: {
      kind: "chat",
      sourceUrl,
      title,
      ...(sourceSessionId ? { sourceSessionId, sourceSessionKey: sourceSessionId } : {}),
    },
    sourceSnapshot: {
      snapshotJson: JSON.stringify({
        capturedAt: new Date().toISOString(),
        messageCount: messages.length,
        messages: messages.map((message) => ({
          contentLength: message.contentText?.length ?? 0,
          role: message.role,
          sequenceNumber: message.sequenceNumber,
          sourceMessageId: message.sourceMessageId,
          sourceMessageKey: message.sourceMessageKey,
        })),
        parserVersion: CHATGPT_PARSER_VERSION,
        providerKey: provider.providerKey,
        sourceUrl,
        title,
      }),
      sourceUrl,
    },
  }
}

export function toManualSyncPayload(extracted: ExtractedSession): SessionCaptureManualSyncBody {
  return {
    messages: extracted.messages,
    ...(extracted.observation ? { observation: extracted.observation } : {}),
    parserVersion: extracted.parserVersion,
    provider: extracted.provider,
    session: extracted.session,
    ...(extracted.sourceSnapshot ? { sourceSnapshot: extracted.sourceSnapshot } : {}),
  }
}

function normalizeUrl(url: URL) {
  url.hash = ""
  return url.toString()
}

function extractSessionId(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean)
  const conversationIndex = parts.indexOf("c")
  if (conversationIndex >= 0) return parts[conversationIndex + 1]
  return parts.at(-1)
}

function findTitle(document: Document) {
  const candidates = [
    document.querySelector("main h1"),
    document.querySelector("h1"),
    document.querySelector('[data-testid="conversation-title"]'),
    document.querySelector("title"),
  ]
  for (const candidate of candidates) {
    const text = normalizeText(candidate?.textContent ?? "")
    if (text) return text
  }
  return null
}

function extractMessages(document: Document): ExtractedMessage[] {
  const articles = Array.from(
    document.querySelectorAll<HTMLElement>('article[data-testid^="conversation-turn-"]'),
  )
  const messageRoots =
    articles.length > 0
      ? articles
      : Array.from(document.querySelectorAll<HTMLElement>("[data-message-author-role]"))

  return messageRoots
    .map((root, index) => extractMessage(root, index + 1))
    .filter((message): message is ExtractedMessage => Boolean(message))
}

function extractMessage(root: HTMLElement, sequence: number): ExtractedMessage | null {
  const roleElement = root.matches("[data-message-author-role]")
    ? root
    : root.querySelector<HTMLElement>("[data-message-author-role]")
  const contentRoot = roleElement ?? root
  const contentText = normalizeText(contentRoot.innerText || contentRoot.textContent || "")
  if (!contentText) return null

  const role = normalizeRole(roleElement?.dataset.messageAuthorRole)
  const sequenceNumber = String(sequence).padStart(6, "0")
  const sourceMessageId =
    roleElement?.dataset.messageId ??
    contentRoot.getAttribute("data-message-id") ??
    root.getAttribute("data-message-id") ??
    undefined
  const sourceMessageKey = sourceMessageId ?? `chatgpt:${sequenceNumber}:${role}:${contentText}`

  return {
    contentText,
    role,
    sequenceNumber,
    sourceMessageKey,
    ...(sourceMessageId ? { sourceMessageId } : {}),
  }
}

function normalizeRole(value: string | undefined): CapturedMessageRole {
  if (value === "user" || value === "assistant" || value === "system" || value === "tool") {
    return value
  }
  return "unknown"
}

function normalizeText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

import type { CapturedMessageRole, SessionCaptureManualSyncBody } from "@contextbase/contracts"

import { fetchImageArtifactData } from "./image-artifacts"
import type { ExtractedArtifact, ExtractedMessage, ExtractedSession, ProviderMatch } from "./types"

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
  const { artifacts, messages } = extractMessagesAndArtifacts(document)
  const sourceUrl = normalizeUrl(url)

  return {
    ...(artifacts.length > 0 ? { artifacts } : {}),
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
    ...(extracted.artifacts
      ? {
          artifacts: extracted.artifacts.map(
            ({ imageData: _imageData, imageFetchUrl: _imageFetchUrl, ...artifact }) => artifact,
          ),
        }
      : {}),
    messages: extracted.messages,
    ...(extracted.observation ? { observation: extracted.observation } : {}),
    parserVersion: extracted.parserVersion,
    provider: extracted.provider,
    session: extracted.session,
    ...(extracted.sourceSnapshot ? { sourceSnapshot: extracted.sourceSnapshot } : {}),
  }
}

export async function hydrateChatGptImageArtifacts(
  extracted: ExtractedSession,
  fetchFn: typeof fetch = fetch,
): Promise<ExtractedSession> {
  if (!extracted.artifacts?.length) return extracted

  const artifacts = await Promise.all(
    extracted.artifacts.map(async (artifact) => {
      if (artifact.imageData || !artifact.imageFetchUrl) return artifact
      const imageData = await fetchImageArtifactData(artifact, fetchFn)
      return imageData ? { ...artifact, contentType: imageData.contentType, imageData } : artifact
    }),
  )

  return { ...extracted, artifacts }
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

function extractMessagesAndArtifacts(document: Document): {
  artifacts: ExtractedArtifact[]
  messages: ExtractedMessage[]
} {
  const articles = Array.from(
    document.querySelectorAll<HTMLElement>('article[data-testid^="conversation-turn-"]'),
  )
  const messageRoots =
    articles.length > 0
      ? articles
      : Array.from(document.querySelectorAll<HTMLElement>("[data-message-author-role]"))

  const artifacts: ExtractedArtifact[] = []
  const messages = messageRoots
    .map((root, index) => {
      const extracted = extractMessage(root, index + 1)
      if (!extracted) return null
      artifacts.push(...extractImageArtifacts(root, extracted))
      return extracted
    })
    .filter((message): message is ExtractedMessage => Boolean(message))

  const globalImageArtifacts = extractGlobalImageArtifacts(document, messageRoots, messages.length)
  if (globalImageArtifacts) {
    messages.push(...globalImageArtifacts.messages)
    artifacts.push(...globalImageArtifacts.artifacts)
  }

  return { artifacts, messages }
}

function extractMessage(root: HTMLElement, sequence: number): ExtractedMessage | null {
  const roleElement = root.matches("[data-message-author-role]")
    ? root
    : root.querySelector<HTMLElement>("[data-message-author-role]")
  const contentRoot = roleElement ?? root
  const contentText = normalizeText(contentRoot.innerText || contentRoot.textContent || "")
  const hasImageArtifact = root.querySelector("img") !== null
  if (!contentText && !hasImageArtifact) return null

  const role = normalizeRole(roleElement?.dataset.messageAuthorRole)
  const sequenceNumber = String(sequence).padStart(6, "0")
  const sourceMessageId =
    roleElement?.dataset.messageId ??
    contentRoot.getAttribute("data-message-id") ??
    root.getAttribute("data-message-id") ??
    undefined
  const sourceMessageKey =
    sourceMessageId ?? `chatgpt:${sequenceNumber}:${role}:${contentText || "media"}`

  return {
    role,
    sequenceNumber,
    sourceMessageKey,
    ...(contentText ? { contentText } : {}),
    ...(sourceMessageId ? { sourceMessageId } : {}),
  }
}

function extractImageArtifacts(root: HTMLElement, message: ExtractedMessage): ExtractedArtifact[] {
  const images = uniqueImagesByIdentity(Array.from(root.querySelectorAll<HTMLImageElement>("img")))
  return images
    .map((image, index) => imageArtifactFromElement(image, message, index))
    .filter((artifact): artifact is ExtractedArtifact => artifact !== null)
}

function extractGlobalImageArtifacts(
  document: Document,
  messageRoots: HTMLElement[],
  currentMessageCount: number,
) {
  const images = uniqueImagesByIdentity(
    Array.from(document.querySelectorAll<HTMLImageElement>("main img")).filter(
      (image) =>
        !messageRoots.some((root) => root.contains(image)) &&
        isLikelyConversationImage(image) &&
        !isInsideNonConversationChrome(image),
    ),
  )
  if (images.length === 0) return null

  const messages: ExtractedMessage[] = []
  const artifacts: ExtractedArtifact[] = []

  images.forEach((image, index) => {
    const identity = imageIdentityFromElement(image)
    const sequenceNumber = String(currentMessageCount + index + 1).padStart(6, "0")
    const message: ExtractedMessage = {
      role: "assistant",
      sequenceNumber,
      sourceMessageKey: `chatgpt:assistant:generated-image:${identity}`,
    }
    const artifact = imageArtifactFromElement(image, message, 0, `chatgpt:image:${identity}`)
    messages.push(message)
    if (artifact) artifacts.push(artifact)
  })

  return artifacts.length > 0 ? { artifacts, messages } : null
}

function imageArtifactFromElement(
  image: HTMLImageElement,
  message: ExtractedMessage,
  index: number,
  sourceArtifactKey?: string,
): ExtractedArtifact | null {
  const sourceUrl = image.currentSrc || image.src || image.getAttribute("src") || ""
  if (!sourceUrl) return null

  const identity = imageIdentityFromUrl(sourceUrl)
  const title =
    normalizeText(image.getAttribute("alt") ?? "") ||
    normalizeText(image.getAttribute("title") ?? "") ||
    `Image ${index + 1}`
  const capturedMessageSourceKey =
    message.sourceMessageKey ?? message.sourceMessageId ?? message.sequenceNumber

  return {
    artifactKind: "image" as const,
    capturedMessageSourceKey,
    contentType: contentTypeFromDataUrl(sourceUrl) ?? "image/*",
    imageFetchUrl: sourceUrl,
    sourceArtifactKey: sourceArtifactKey ?? `${capturedMessageSourceKey}:image:${identity}`,
    title,
  }
}

function uniqueImagesByIdentity(images: HTMLImageElement[]) {
  const seen = new Set<string>()
  const unique: HTMLImageElement[] = []

  for (const image of images) {
    const identity = imageIdentityFromElement(image)
    if (seen.has(identity)) continue
    seen.add(identity)
    unique.push(image)
  }

  return unique
}

function imageIdentityFromElement(image: HTMLImageElement) {
  const sourceUrl = image.currentSrc || image.src || image.getAttribute("src") || ""
  return imageIdentityFromUrl(sourceUrl)
}

function imageIdentityFromUrl(sourceUrl: string) {
  try {
    const parsed = new URL(sourceUrl)
    if (
      parsed.hostname === "chatgpt.com" &&
      parsed.pathname.startsWith("/backend-api/estuary/content")
    ) {
      const fileId = parsed.searchParams.get("id")
      if (fileId) return `chatgpt-estuary:${fileId}`
    }
    return parsed.toString()
  } catch {
    if (sourceUrl.startsWith("data:image/")) {
      return `data-image:${stableStringHash(sourceUrl)}`
    }
    return sourceUrl
  }
}

function isLikelyConversationImage(image: HTMLImageElement) {
  const sourceUrl = image.currentSrc || image.src || image.getAttribute("src") || ""
  const label = `${image.getAttribute("alt") ?? ""} ${image.getAttribute("title") ?? ""}`
  return (
    sourceUrl.startsWith("data:image/") ||
    sourceUrl.startsWith("blob:") ||
    isProtectedChatGptImageUrl(sourceUrl) ||
    isConversationImageLabel(label) ||
    /\.(avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(sourceUrl) ||
    /\.(avif|gif|jpe?g|png|webp)\b/i.test(label)
  )
}

function isProtectedChatGptImageUrl(sourceUrl: string) {
  try {
    const parsed = new URL(sourceUrl)
    if (
      parsed.hostname === "chatgpt.com" &&
      parsed.pathname.startsWith("/backend-api/estuary/content")
    ) {
      return true
    }
    if (parsed.hostname.endsWith(".oaiusercontent.com")) return true
    if (parsed.hostname.endsWith(".blob.core.windows.net")) return true
  } catch {
    return false
  }
  return false
}

function isConversationImageLabel(label: string) {
  return /\b(generated image|uploaded image|attached image|image attachment)\b/i.test(label)
}

function isInsideNonConversationChrome(element: HTMLElement) {
  return element.closest("header, nav, aside, footer") !== null
}

function contentTypeFromDataUrl(value: string) {
  const match = value.match(/^data:([^;,]+);base64,/)
  return match?.[1] ? match[1] : null
}

function stableStringHash(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
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
    .filter((line) => line.length > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

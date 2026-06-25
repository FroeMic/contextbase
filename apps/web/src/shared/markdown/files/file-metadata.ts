import { parseContextbaseFileUrl } from "./file-url"

export type InlineFileKind = "image" | "markdown" | "unsupported"

export type InlineFileMetadata = {
  contentType: string | null | undefined
  originalFilename: string | null | undefined
}

export function classifyInlineFile(file: InlineFileMetadata): InlineFileKind {
  const contentType = file.contentType?.toLowerCase() ?? ""
  const filename = file.originalFilename?.toLowerCase() ?? ""
  if (contentType.startsWith("image/")) return "image"
  if (
    contentType === "text/markdown" ||
    filename.endsWith(".md") ||
    filename.endsWith(".markdown")
  ) {
    return "markdown"
  }
  return "unsupported"
}

export function isStandaloneContextbaseFileLink(markdown: string) {
  const trimmed = markdown.trim()
  if (trimmed.startsWith("!")) return false
  const match = /^\[([^\]]+)]\(([^)\s]+)(?:\s+"[^"]*")?\)$/.exec(trimmed)
  if (!match?.[2]) return false
  return parseContextbaseFileUrl(match[2]) !== null
}

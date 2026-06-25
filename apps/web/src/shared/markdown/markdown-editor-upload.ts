export type MarkdownInlineUploadResult = {
  assetUrl?: string | null
  contentUrl: string
  markdownImage?: string | null
  markdownLink?: string | null
  originalFilename?: string | null
}

export function filesFromTransfer(transfer: DataTransfer | null): File[] {
  if (!transfer) return []

  const files =
    transfer.items.length > 0
      ? Array.from(transfer.items)
          .filter((item) => item.kind === "file")
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null)
      : Array.from(transfer.files)

  return files
}

export function markdownFileReferenceForUpload(file: File, result: MarkdownInlineUploadResult) {
  const label = result.originalFilename ?? file.name
  const href = uploadedFileMarkdownUrl(result)
  if (file.type.startsWith("image/")) {
    if (result.markdownImage) return result.markdownImage
    return markdownImageReference(label, href)
  }
  if (result.markdownLink) return result.markdownLink
  return markdownFileLinkReference(label, href)
}

export function markdownImageReferenceForUpload(file: File, result: MarkdownInlineUploadResult) {
  return markdownImageReference(
    result.originalFilename ?? file.name,
    uploadedFileMarkdownUrl(result),
  )
}

export function appendMarkdownFileReferences(markdown: string, references: string[]) {
  return appendMarkdownReferences(markdown, references)
}

export function appendMarkdownImageReferences(markdown: string, references: string[]) {
  return appendMarkdownReferences(markdown, references)
}

function appendMarkdownReferences(markdown: string, references: string[]) {
  const existing = markdown.trimEnd()
  const nextReferences = references.filter(Boolean).join("\n")
  if (!existing) return nextReferences
  if (!nextReferences) return existing
  return `${existing}\n\n${nextReferences}`
}

function markdownImageReference(label: string, contentUrl: string) {
  return `![${sanitizeMarkdownLabel(label, "image")}](${contentUrl})`
}

function markdownFileLinkReference(label: string, contentUrl: string) {
  return `[${sanitizeMarkdownLabel(label, "file")}](${contentUrl})`
}

function uploadedFileMarkdownUrl(result: MarkdownInlineUploadResult) {
  return result.assetUrl || result.contentUrl
}

function sanitizeMarkdownLabel(value: string, fallback: string) {
  return value.replaceAll("[", "(").replaceAll("]", ")").trim() || fallback
}

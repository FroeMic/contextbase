export type FileOpenIntent = {
  attachmentId?: string | null
  commentId?: string | null
  open: boolean
  referenceId?: string | null
}

export function parseFileOpenSearchParams(params: URLSearchParams): FileOpenIntent {
  return {
    attachmentId: normalizeParam(params.get("attachment")),
    commentId: normalizeParam(params.get("comment")),
    open: params.get("open") === "1",
    referenceId: normalizeParam(params.get("ref")),
  }
}

export function buildFileOpenSearchParams(intent: FileOpenIntent) {
  const params = new URLSearchParams()
  if (intent.referenceId) params.set("ref", intent.referenceId)
  if (intent.attachmentId) params.set("attachment", intent.attachmentId)
  if (intent.commentId) params.set("comment", intent.commentId)
  if (intent.open) params.set("open", "1")
  return params
}

export function buildFileOpenUrl(rawUrl: string, intent: FileOpenIntent) {
  const url = new URL(rawUrl)
  url.searchParams.delete("ref")
  url.searchParams.delete("attachment")
  url.searchParams.delete("comment")
  url.searchParams.delete("open")
  const params = buildFileOpenSearchParams(intent)
  params.forEach((value, key) => {
    url.searchParams.set(key, value)
  })
  return url.toString()
}

function normalizeParam(value: string | null) {
  return value?.trim() || null
}

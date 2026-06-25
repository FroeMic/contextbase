export type ParsedContextbaseFileFragment = {
  refId: string | null
  width: number | null
}

export type ParsedContextbaseFileUrl = ParsedContextbaseFileFragment & {
  fileId: string
  rawUrl: string
}

const contextbaseFileIdPattern =
  /(?:^|\/)((?:file|fil)_[A-Za-z0-9_]+)\/(?:content|original)(?:$|[/?#])/
const minFileWidth = 0.2
const maxFileWidth = 1

export function parseContextbaseFileUrl(rawUrl: string): ParsedContextbaseFileUrl | null {
  const fileId = extractContextbaseFileId(rawUrl)
  if (!fileId) return null
  return {
    ...parseContextbaseFileFragment(rawUrl),
    fileId,
    rawUrl,
  }
}

export function parseContextbaseFileFragment(rawUrl: string): ParsedContextbaseFileFragment {
  const params = fragmentParams(rawUrl)
  const rawWidth = params.get("v-width")
  const parsedWidth = rawWidth === null ? Number.NaN : Number.parseFloat(rawWidth)
  return {
    refId: normalizeFragmentValue(params.get("v-ref")),
    width: Number.isFinite(parsedWidth) ? clampFileWidth(parsedWidth) : null,
  }
}

export function withContextbaseFileReference(rawUrl: string, referenceId: string) {
  return rebuildUrlWithContextbaseFragment(rawUrl, (params) => {
    params.set("v-ref", referenceId)
  })
}

export function withContextbaseFileWidth(rawUrl: string, width: number | null) {
  return rebuildUrlWithContextbaseFragment(rawUrl, (params) => {
    if (width === null) {
      params.delete("v-width")
      return
    }
    params.set("v-width", formatFileWidth(clampFileWidth(width)))
  })
}

export function fileUrlForNetwork(rawUrl: string) {
  const [withoutFragment, fragment = ""] = rawUrl.split("#", 2)
  const previousParams = new URLSearchParams(fragment)
  const nextParams = new URLSearchParams()
  previousParams.forEach((value, key) => {
    if (!key.startsWith("v-")) nextParams.append(key, value)
  })
  const serialized = nextParams.toString()
  const networkUrl = browserFileContentPath(withoutFragment) ?? withoutFragment
  return serialized ? `${networkUrl}#${serialized}` : networkUrl
}

export function fileUrlForClipboard(rawUrl: string, origin = browserOrigin()) {
  const clipboardUrl = stripContextbaseFileFragment(rawUrl)
  if (!origin || !clipboardUrl.startsWith("/")) return clipboardUrl
  return new URL(clipboardUrl, origin).toString()
}

function stripContextbaseFileFragment(rawUrl: string) {
  const [withoutFragment, fragment = ""] = rawUrl.split("#", 2)
  const previousParams = new URLSearchParams(fragment)
  const nextParams = new URLSearchParams()
  previousParams.forEach((value, key) => {
    if (!key.startsWith("v-")) nextParams.append(key, value)
  })
  const serialized = nextParams.toString()
  return serialized ? `${withoutFragment}#${serialized}` : withoutFragment
}

function extractContextbaseFileId(rawUrl: string) {
  const withoutFragment = rawUrl.split("#", 1)[0] ?? rawUrl
  const match = contextbaseFileIdPattern.exec(withoutFragment)
  return match?.[1] ?? null
}

function browserFileContentPath(rawUrl: string) {
  const fileId = extractContextbaseFileId(rawUrl)
  if (!fileId) return null

  try {
    const parsed = new URL(rawUrl, "http://contextbase.local")
    return `/api/files/${encodeURIComponent(fileId)}/content${parsed.search}`
  } catch {
    return `/api/files/${encodeURIComponent(fileId)}/content`
  }
}

function browserOrigin() {
  if (typeof window === "undefined") return null
  return window.location.origin
}

function rebuildUrlWithContextbaseFragment(
  rawUrl: string,
  update: (contextbaseParams: URLSearchParams) => void,
) {
  const [withoutFragment, fragment = ""] = rawUrl.split("#", 2)
  const previousParams = new URLSearchParams(fragment)
  const nextParams = new URLSearchParams()

  previousParams.forEach((value, key) => {
    if (!key.startsWith("v-")) nextParams.append(key, value)
  })

  const contextbaseParams = new URLSearchParams()
  const refId = previousParams.get("v-ref")
  const width = previousParams.get("v-width")
  if (refId) contextbaseParams.set("v-ref", refId)
  if (width)
    contextbaseParams.set("v-width", formatFileWidth(clampFileWidth(Number.parseFloat(width))))
  update(contextbaseParams)

  const nextRefId = contextbaseParams.get("v-ref")
  const nextWidth = contextbaseParams.get("v-width")
  if (nextRefId) nextParams.set("v-ref", nextRefId)
  if (nextWidth) nextParams.set("v-width", nextWidth)

  const serialized = nextParams.toString()
  return serialized ? `${withoutFragment}#${serialized}` : withoutFragment
}

function fragmentParams(rawUrl: string) {
  return new URLSearchParams(rawUrl.split("#", 2)[1] ?? "")
}

function normalizeFragmentValue(value: string | null) {
  return value?.trim() || null
}

function clampFileWidth(width: number) {
  if (!Number.isFinite(width)) return maxFileWidth
  return Math.min(maxFileWidth, Math.max(minFileWidth, width))
}

function formatFileWidth(width: number) {
  return String(Number(width.toFixed(3)))
}

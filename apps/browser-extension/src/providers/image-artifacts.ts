import type { ExtractedArtifact, ExtractedImageData } from "./types"

export async function fetchImageArtifactData(
  artifact: ExtractedArtifact,
  fetchFn: typeof fetch = fetch,
): Promise<ExtractedImageData | null> {
  if (!artifact.imageFetchUrl) return null

  try {
    const response = await fetchFn(artifact.imageFetchUrl, {
      credentials: "include",
    })
    if (!response.ok) return null

    const contentType = normalizeImageContentType(
      response.headers.get("content-type"),
      artifact.contentType,
    )
    if (!contentType) return null

    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType,
      filename: imageFilename({
        contentType,
        title: artifact.title,
        url: artifact.imageFetchUrl,
      }),
    }
  } catch {
    return null
  }
}

export function imageBytesAsArrayBuffer(bytes: ExtractedImageData["bytes"]) {
  if (bytes instanceof Uint8Array) {
    return bytes.slice().buffer
  }
  if (Array.isArray(bytes)) {
    return Uint8Array.from(bytes).buffer
  }
  return Uint8Array.from(
    Object.keys(bytes)
      .sort((left, right) => Number(left) - Number(right))
      .map((key) => bytes[key] ?? 0),
  ).buffer
}

export function imageFilename(input: {
  contentType: string
  title?: string | null
  url?: string | null
}) {
  const titleFilename = sanitizeImageFilename(input.title)
  if (titleFilename && hasImageExtension(titleFilename)) return titleFilename

  const urlFilename = filenameFromUrl(input.url)
  if (urlFilename && hasImageExtension(urlFilename)) return urlFilename

  const extension = imageExtension(input.contentType)
  const basename =
    (titleFilename ?? urlFilename ?? "image")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "image"
  return `${basename}.${extension}`
}

function normalizeImageContentType(
  responseContentType: string | null,
  fallbackContentType: string | undefined,
) {
  const contentType = (responseContentType ?? fallbackContentType ?? "")
    .split(";")[0]
    ?.trim()
    .toLowerCase()
  if (!contentType || contentType === "image/*" || !contentType.startsWith("image/")) {
    return null
  }
  return contentType
}

function filenameFromUrl(url: string | null | undefined) {
  if (!url) return null
  try {
    return sanitizeImageFilename(new URL(url).pathname.split("/").at(-1))
  } catch {
    return null
  }
}

function sanitizeImageFilename(value: string | null | undefined) {
  const filename = (value ?? "")
    .replaceAll("\\", "/")
    .split("/")
    .at(-1)
    ?.replace(/[^\w .-]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96)

  return filename && filename.length > 0 ? filename : null
}

function hasImageExtension(value: string) {
  return /\.(gif|jpe?g|png|webp)$/i.test(value)
}

function imageExtension(contentType: string) {
  if (contentType === "image/jpeg" || contentType === "image/jpg") return "jpg"
  const subtype = contentType.split("/")[1]?.replace(/[^a-z0-9]/gi, "")
  return subtype || "image"
}

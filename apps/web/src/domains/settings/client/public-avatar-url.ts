type PublicAvatarFile = {
  deletedAt?: number | null
  publicAssetId?: string | null
  storageStatus?: string | null
  usageKind?: string | null
  visibility?: string | null
}

export function buildPublicAvatarUrl(file: PublicAvatarFile | null | undefined) {
  if (!file?.publicAssetId) return ""
  if (file.visibility !== "public") return ""
  if (file.usageKind !== "avatar") return ""
  if (file.storageStatus !== "available") return ""
  if (file.deletedAt) return ""

  const baseUrl = (
    import.meta.env.VITE_CONTEXTBASE_PUBLIC_ASSETS_BASE_URL ??
    import.meta.env.VITE_PUBLIC_ASSETS_BASE_URL ??
    "/public"
  ).replace(/\/$/, "")

  return `${baseUrl}/avatars/${encodeURIComponent(file.publicAssetId)}`
}

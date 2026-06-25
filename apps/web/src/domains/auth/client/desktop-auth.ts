export type MagicLinkClientKind = "browser" | "desktop"

type DesktopCapabilities = {
  desktopShell?: boolean
  localRunner?: boolean
}

type DesktopAuthSource = {
  verticalDesktop?: {
    getCapabilities?: () => Promise<DesktopCapabilities>
  }
}

export async function detectMagicLinkClientKind(
  source: DesktopAuthSource = globalThis as DesktopAuthSource,
): Promise<MagicLinkClientKind> {
  try {
    const capabilities = await source.verticalDesktop?.getCapabilities?.()
    return capabilities?.desktopShell === true ? "desktop" : "browser"
  } catch {
    return "browser"
  }
}

export function desktopMagicLinkVerifyUrl(desktopVerifyUrl: string): string {
  const sourceUrl = new URL(desktopVerifyUrl)
  const verifyUrl = new URL("/auth/verify", sourceUrl.origin)
  const token = sourceUrl.searchParams.get("token")
  const redirectTo = sourceUrl.searchParams.get("redirect_to")

  if (token) {
    verifyUrl.searchParams.set("token", token)
  }
  if (redirectTo) {
    verifyUrl.searchParams.set("redirect_to", redirectTo)
  }

  return verifyUrl.toString()
}

export function buildDesktopMagicLinkHandoffUrl(verifyUrl: string): string {
  const handoffUrl = new URL("contextbase://open")
  handoffUrl.searchParams.set("url", verifyUrl)
  return handoffUrl.toString()
}

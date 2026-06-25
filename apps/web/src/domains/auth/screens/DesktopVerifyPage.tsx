import { useEffect, useState } from "react"

import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card"

import { buildDesktopMagicLinkHandoffUrl, desktopMagicLinkVerifyUrl } from "../client/desktop-auth"

type DesktopVerifyLinks = {
  browserVerifyUrl: string
  desktopHandoffUrl: string
}

export function DesktopVerifyPage({ redirectTo, token }: { redirectTo?: string; token?: string }) {
  const [links, setLinks] = useState<DesktopVerifyLinks | null>(null)

  useEffect(() => {
    if (!token) return

    const desktopVerifyUrl = new URL(window.location.href)
    desktopVerifyUrl.search = ""
    desktopVerifyUrl.searchParams.set("token", token)
    if (redirectTo) {
      desktopVerifyUrl.searchParams.set("redirect_to", redirectTo)
    }

    const browserVerifyUrl = desktopMagicLinkVerifyUrl(desktopVerifyUrl.toString())
    const desktopHandoffUrl = buildDesktopMagicLinkHandoffUrl(browserVerifyUrl)
    const desktopProtocolPrefix = "contextbase://open"

    setLinks({ browserVerifyUrl, desktopHandoffUrl })
    if (desktopHandoffUrl.startsWith(desktopProtocolPrefix)) {
      window.location.assign(desktopHandoffUrl)
    }
  }, [redirectTo, token])

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <Card className="w-full max-w-sm rounded-lg" size="sm">
        <CardHeader>
          <CardTitle>{token ? "Opening Contextbase Desktop" : "Sign-in failed"}</CardTitle>
          <CardDescription aria-live="polite">
            {token
              ? "Your desktop session is being opened."
              : "This desktop sign-in link is missing a token."}
          </CardDescription>
        </CardHeader>
        {links ? (
          <CardContent>
            <Button
              nativeButton={false}
              render={<a href={links.browserVerifyUrl}>Continue in browser</a>}
              size="sm"
            />
          </CardContent>
        ) : null}
      </Card>
    </main>
  )
}

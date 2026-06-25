import { ScriptOnce } from "@tanstack/react-router"
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react"

import { setBrowserCookie } from "../browser/cookies"

export type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const validThemes = new Set<Theme>(["dark", "light", "system"])
const sharedThemeCookieName = "vertical-ui-theme"

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = sharedThemeCookieName,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const storedLocal = localStorage.getItem(storageKey)
    const storedCookie = readThemeCookie(storageKey)
    const stored = isTheme(storedLocal) ? storedLocal : storedCookie
    const nextTheme = isTheme(stored) ? stored : defaultTheme
    persistTheme(storageKey, nextTheme)
    setThemeState(nextTheme)
    setMounted(true)
  }, [defaultTheme, storageKey])

  useEffect(() => {
    if (!mounted) return
    applyTheme(theme)
  }, [mounted, theme])

  useEffect(() => {
    if (!mounted || theme !== "system") return

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => applyTheme("system")

    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [mounted, theme])

  const value = useMemo(
    () => ({
      setTheme: (nextTheme: Theme) => {
        persistTheme(storageKey, nextTheme)
        setThemeState(nextTheme)
      },
      theme,
    }),
    [storageKey, theme],
  )

  return (
    <ThemeProviderContext.Provider value={value}>
      <ScriptOnce>{getThemeScript(storageKey, defaultTheme)}</ScriptOnce>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeProviderContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}

export function getThemeScript(storageKey: string, defaultTheme: Theme) {
  const key = JSON.stringify(storageKey)
  const fallback = JSON.stringify(defaultTheme)

  return `(function(){try{var k=${key};var l=localStorage.getItem(k);var c=document.cookie.match(new RegExp("(?:^|; )"+k.replace(/[.$?*|{}()[\\]\\\\/+^]/g,"\\\\$&")+"=([^;]*)"));var t=l==="light"||l==="dark"||l==="system"?l:c?decodeURIComponent(c[1]):null;if(t!=="light"&&t!=="dark"&&t!=="system"){t=${fallback}}localStorage.setItem(k,t);document.cookie=k+"="+encodeURIComponent(t)+"; Path=/; Max-Age=31536000; SameSite=Lax";var d=matchMedia("(prefers-color-scheme: dark)").matches;var r=t==="system"?(d?"dark":"light"):t;var e=document.documentElement;e.classList.remove("light","dark");e.classList.add(r);e.style.colorScheme=r}catch(e){}})();`
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove("light", "dark")

  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme

  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

function isTheme(value: string | null): value is Theme {
  return validThemes.has(value as Theme)
}

function persistTheme(storageKey: string, theme: Theme) {
  localStorage.setItem(storageKey, theme)
  setBrowserCookie(storageKey, theme, {
    domain: themeCookieDomain(),
    maxAge: 31_536_000,
    path: "/",
    sameSite: "Lax",
    secure: location.protocol === "https:",
  })
}

function readThemeCookie(storageKey: string) {
  const escapedKey = storageKey.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&")
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedKey}=([^;]*)`))
  return match ? decodeURIComponent(match[1] ?? "") : null
}

function themeCookieDomain() {
  const hostname = location.hostname
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return undefined

  const parts = hostname.split(".")
  if (parts.length < 2) return undefined

  return `.${parts.slice(-2).join(".")}`
}

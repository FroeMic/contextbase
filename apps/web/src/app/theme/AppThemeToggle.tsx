"use client"

import { useTheme } from "../../shared/theme/theme-provider"
import { Button } from "../../shared/ui/button"

export function AppThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <Button
      aria-label="Toggle color theme"
      className="text-muted-foreground hover:text-foreground"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      size="icon-xs"
      title="Toggle color theme"
      type="button"
      variant="ghost"
    >
      <BrightnessIcon />
    </Button>
  )
}

function BrightnessIcon() {
  return (
    <svg
      aria-hidden="true"
      className="tabler-icon tabler-icon-brightness size-4"
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
      <path d="M12 3l0 18" />
      <path d="M12 9l4.65 -4.65" />
      <path d="M12 14.3l7.37 -7.37" />
      <path d="M12 19.6l8.85 -8.85" />
    </svg>
  )
}

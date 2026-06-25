import { Check, Copy } from "lucide-react"
import { type ButtonHTMLAttributes, useEffect, useState } from "react"

import { cn } from "./cn"

const COPIED_RESET_DELAY_MS = 2200

type CopyValue = string | null | undefined

export function CopyIconButton({
  className,
  copiedLabel,
  iconClassName,
  label,
  value,
  ...props
}: Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children" | "onClick" | "value"
> & {
  copiedLabel?: string
  iconClassName?: string
  label: string
  value: CopyValue | (() => CopyValue | Promise<CopyValue>)
}) {
  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    if (!isCopied) return

    const timeout = window.setTimeout(() => setIsCopied(false), COPIED_RESET_DELAY_MS)
    return () => window.clearTimeout(timeout)
  }, [isCopied])

  async function copyValue() {
    const nextValue = typeof value === "function" ? await value() : value
    if (!nextValue) return
    await navigator.clipboard?.writeText(nextValue)
    setIsCopied(true)
  }

  const Icon = isCopied ? Check : Copy

  return (
    <button
      aria-label={isCopied ? (copiedLabel ?? "Copied") : label}
      className={cn("transition-transform active:scale-95", className)}
      onClick={() => void copyValue()}
      type="button"
      {...props}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "transition-transform",
          iconClassName,
          isCopied && "scale-110 text-green-600",
        )}
      />
      <span className="sr-only">{isCopied ? (copiedLabel ?? "Copied") : label}</span>
    </button>
  )
}

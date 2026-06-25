import type { ReactNode } from "react"

export function SettingsDialogDetailRow({
  label,
  title,
  value,
}: {
  label: string
  title?: string
  value: ReactNode
}) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-4 border-b border-border py-3 last:border-b-0">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="min-w-0 grow truncate text-right text-sm" title={title}>
        {value}
      </div>
    </div>
  )
}

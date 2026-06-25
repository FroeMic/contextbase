import { cn } from "./cn"

export function CollapseChevron({ className, isOpen }: { className?: string; isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0 fill-current transition-transform",
        isOpen ? "rotate-0" : "rotate-[-90deg]",
        className,
      )}
      focusable="false"
      role="img"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M5.37613 7.00194C5.18169 6.66861 5.42212 6.25 5.80802 6.25L10.192 6.25C10.5779 6.25 10.8183 6.66861 10.6239 7.00194L8.43189 10.7596C8.23895 11.0904 7.76105 11.0904 7.56811 10.7596L5.37613 7.00194Z" />
    </svg>
  )
}

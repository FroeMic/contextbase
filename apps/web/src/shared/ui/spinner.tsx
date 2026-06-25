/* biome-ignore-all lint/a11y/useSemanticElements: spinner exposes status semantics on the icon-only loading primitive. */
import { Loader2Icon } from "lucide-react"
import { cn } from "@/shared/ui/cn"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }

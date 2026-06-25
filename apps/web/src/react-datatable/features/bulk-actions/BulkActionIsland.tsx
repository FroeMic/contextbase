import { Button } from "../../components/ui/button"
import { CloseIcon, WorkflowIcon } from "../../components/ui/icons"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip"

interface BulkActionIslandProps {
  selectedCount: number
  onClear: () => void
  onTrigger: () => void
  triggerLabel?: string
}

export function BulkActionIsland({
  selectedCount,
  onClear,
  onTrigger,
  triggerLabel = "Actions",
}: BulkActionIslandProps) {
  if (selectedCount <= 0) {
    return null
  }

  return (
    <div className="pointer-events-none absolute right-0 bottom-8 left-0 z-20 flex justify-center px-4">
      <div className="bg-background/95 border-border pointer-events-auto inline-flex items-center gap-1.5 rounded-full border px-2 py-1.5 backdrop-blur-sm">
        <div className="border-border bg-background inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium">
          {selectedCount.toLocaleString()} selected
        </div>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-8 w-8 rounded-full p-0"
                aria-label="Clear selection"
                title="Dismiss selection"
                onClick={onClear}
              >
                <CloseIcon className="h-3.5 w-3.5" />
                <span className="sr-only">Clear</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Dismiss selection</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="bg-border h-5 w-px" aria-hidden="true" />
        <Button
          type="button"
          variant="outline"
          className="h-8 rounded-full px-3 text-xs shadow-none"
          onClick={onTrigger}
        >
          <WorkflowIcon className="mr-1.5 h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </div>
    </div>
  )
}

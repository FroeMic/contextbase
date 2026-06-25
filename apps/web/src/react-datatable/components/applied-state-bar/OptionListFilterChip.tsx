import type { ReactNode } from "react"
import { memo, useCallback, useState } from "react"
import { cn } from "../../shared/utils/cn"
import { CaretDownIcon, XIcon } from "../ui/icons"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { SearchableDropdown } from "../ui/searchable-dropdown"

interface ModeOption<TMode extends string> {
  value: TMode
  label: string
}

export interface OptionListFilterChipProps<TMode extends string> {
  columnLabel: string
  mode?: TMode
  modeOptions?: readonly ModeOption<TMode>[]
  getModeLabel?: (mode: TMode) => string
  onModeChange?: (mode: TMode) => void
  valueSummary: string
  editor: ReactNode
  onRemove: () => void
  editorWidthClassName?: string
}

function OptionListFilterChipInner<TMode extends string>({
  columnLabel,
  mode,
  modeOptions,
  getModeLabel,
  onModeChange,
  valueSummary,
  editor,
  onRemove,
  editorWidthClassName = "w-60",
}: OptionListFilterChipProps<TMode>) {
  const [valuesOpen, setValuesOpen] = useState(false)
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false)

  const handleModeSelect = useCallback(
    (option: ModeOption<TMode>) => {
      onModeChange?.(option.value)
    },
    [onModeChange],
  )

  const hasModeControl = !!mode && !!modeOptions && !!getModeLabel && !!onModeChange

  return (
    <div className="bg-background inline-flex h-6 items-center divide-x overflow-hidden rounded-full border text-xs">
      <span className="px-2 font-medium">{columnLabel}</span>

      {hasModeControl && (
        <SearchableDropdown
          open={modeDropdownOpen}
          onOpenChange={setModeDropdownOpen}
          items={modeOptions}
          getItemKey={(option) => option.value}
          renderItem={(option) => option.label}
          onSelect={handleModeSelect}
          filterFn={(opt, search) => opt.label.toLowerCase().includes(search.toLowerCase())}
          searchPlaceholder="Search"
          emptyText="No modes found"
          align="start"
          width="w-40"
        >
          <button
            type="button"
            className="hover:bg-accent text-muted-foreground flex h-full items-center gap-1 px-2 transition-colors"
          >
            <span>{getModeLabel(mode)}</span>
            <CaretDownIcon className="h-3 w-3" />
          </button>
        </SearchableDropdown>
      )}

      <Popover open={valuesOpen} onOpenChange={setValuesOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "hover:bg-accent h-full max-w-[200px] truncate px-2 transition-colors",
              !hasModeControl && "rounded-r-full",
            )}
            type="button"
          >
            {valueSummary}
          </button>
        </PopoverTrigger>
        <PopoverContent className={cn(editorWidthClassName, "overflow-hidden p-0")} align="start">
          {editor}
        </PopoverContent>
      </Popover>

      <button
        type="button"
        onClick={onRemove}
        className="hover:bg-accent text-muted-foreground hover:text-foreground h-full px-2 transition-colors"
        aria-label={`Remove ${columnLabel} filter`}
      >
        <XIcon className="h-3 w-3" />
      </button>
    </div>
  )
}

export const OptionListFilterChip = memo(
  OptionListFilterChipInner,
) as typeof OptionListFilterChipInner

"use client"

import { Label } from "../../components/ui/label"
import { Switch } from "../../components/ui/switch"
import { cn } from "../../shared/utils/cn"
import { useDatatableStore } from "../../state/store/use-datatable-store"
import type { DatatableQueryOptionDeclaration } from "../../types/props.types"
import type { DatatableQueryOptions } from "../../types/state.types"

interface QueryOptionsSectionProps {
  options: DatatableQueryOptionDeclaration[]
  variant?: "default" | "mobile"
}

export function resolveBooleanQueryOptionValue(
  values: DatatableQueryOptions,
  option: DatatableQueryOptionDeclaration,
): boolean {
  const value = values[option.key]
  return typeof value === "boolean" ? value : option.defaultValue
}

export function QueryOptionsSection({ options, variant = "default" }: QueryOptionsSectionProps) {
  const queryOptions = useDatatableStore((s) => s.queryOptions)
  const setQueryOption = useDatatableStore((s) => s.setQueryOption)

  if (options.length === 0) {
    return null
  }

  return (
    <div className={cn("space-y-2.5", variant === "mobile" && "space-y-3")}>
      <div className="pb-0.5">
        <Label
          className={cn(
            "text-muted-foreground text-xs font-medium",
            variant === "mobile" && "text-sm",
          )}
        >
          Query Options
        </Label>
      </div>

      {options.map((option) => {
        if (option.type !== "boolean") {
          return null
        }

        const checked = resolveBooleanQueryOptionValue(queryOptions, option)

        return (
          <div className="flex items-start justify-between gap-3" key={option.key}>
            <Label
              htmlFor={`query-option-${option.key}`}
              className={cn("cursor-pointer text-xs", variant === "mobile" && "text-sm")}
            >
              <span className="block font-normal">{option.label}</span>
              {option.description ? (
                <span className="mt-0.5 block text-muted-foreground">{option.description}</span>
              ) : null}
            </Label>
            <Switch
              id={`query-option-${option.key}`}
              size="sm"
              checked={checked}
              onCheckedChange={(nextChecked) => setQueryOption(option.key, nextChecked)}
            />
          </div>
        )
      })}
    </div>
  )
}

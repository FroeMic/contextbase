import { format } from "date-fns"
import { CalendarDays } from "lucide-react"
import { useState } from "react"

import { Button } from "@/shared/ui/button"
import { Calendar } from "@/shared/ui/calendar"
import { cn } from "@/shared/ui/cn"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover"

export function DatePicker({
  ariaLabel,
  className,
  id,
  onValueChange,
  placeholder = "Pick a date",
  value,
}: {
  ariaLabel: string
  className?: string
  id?: string
  onValueChange: (value: string) => void
  placeholder?: string
  value: string
}) {
  const [open, setOpen] = useState(false)
  const selectedDate = parseDatePickerValue(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            aria-label={ariaLabel}
            data-empty={!selectedDate}
            id={id}
            type="button"
            variant="ghost"
          />
        }
        className={cn(
          "h-8 w-full justify-start gap-2.5 rounded-md px-0 text-left text-[13px] font-normal data-[empty=true]:text-muted-foreground",
          className,
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">
          {selectedDate ? format(selectedDate, "dd.MM.yyyy") : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-0 rounded-xl p-0" sideOffset={6}>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            onValueChange(formatDatePickerValue(date))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function parseDatePickerValue(value: string) {
  if (!value) return undefined
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function formatDatePickerValue(date: Date | undefined) {
  if (!date) return ""
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

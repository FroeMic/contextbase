import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import type * as React from "react"

import { cn } from "@/shared/ui/cn"

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  onClickCapture,
  onInteractOutside,
  onPointerDownCapture,
  side = "bottom",
  sideOffset = 4,
  ...props
}: PopoverContentProps) {
  function handlePointerDownCapture(
    event: Parameters<NonNullable<PopoverPrimitive.Popup.Props["onPointerDownCapture"]>>[0],
  ) {
    onInteractOutside?.()
    onPointerDownCapture?.(event)
  }

  function handleClickCapture(
    event: Parameters<NonNullable<PopoverPrimitive.Popup.Props["onClickCapture"]>>[0],
  ) {
    onInteractOutside?.()
    onClickCapture?.(event)
  }

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "z-50 flex w-72 origin-(--transform-origin) flex-col gap-4 rounded-2xl bg-popover p-4 text-sm text-popover-foreground shadow-2xl ring-1 ring-foreground/5 outline-hidden",
            className,
          )}
          onClickCapture={handleClickCapture}
          onPointerDownCapture={handlePointerDownCapture}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

type PopoverContentProps = PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset"> & {
    onInteractOutside?: () => void
  }

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-1 text-sm", className)}
      {...props}
    />
  )
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("text-base font-medium", className)}
      {...props}
    />
  )
}

function PopoverDescription({ className, ...props }: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger }

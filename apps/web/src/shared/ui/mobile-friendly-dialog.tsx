import { XIcon } from "lucide-react"
import * as React from "react"

import { useIsMobile } from "@/shared/hooks/use-mobile"
import { Button } from "@/shared/ui/button"
import { cn } from "@/shared/ui/cn"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/ui/drawer"

type MobileFriendlyDialogSurface = "dialog" | "drawer"

const mobileFriendlyNoMotionClassName =
  "duration-0 transition-none data-open:animate-none data-closed:animate-none"

const MobileFriendlyDialogContext = React.createContext<MobileFriendlyDialogSurface>("dialog")

type MobileFriendlyDialogProps = Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  children?: React.ReactNode
  drawerProps?: Omit<React.ComponentProps<typeof Drawer>, "children" | "onOpenChange" | "open">
}

function MobileFriendlyDialog({ children, drawerProps, ...props }: MobileFriendlyDialogProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    const drawerRootProps = {
      direction: "bottom",
      ...drawerProps,
      open: props.open,
      onOpenChange: (open: boolean) => props.onOpenChange?.(open, undefined as never),
    } as React.ComponentProps<typeof Drawer>

    return (
      <MobileFriendlyDialogContext.Provider value="drawer">
        <Drawer {...drawerRootProps}>{children}</Drawer>
      </MobileFriendlyDialogContext.Provider>
    )
  }

  return (
    <MobileFriendlyDialogContext.Provider value="dialog">
      <Dialog {...props}>{children}</Dialog>
    </MobileFriendlyDialogContext.Provider>
  )
}

function MobileFriendlyDialogTrigger({
  children,
  ...props
}: React.ComponentProps<typeof DialogTrigger>) {
  const surface = React.useContext(MobileFriendlyDialogContext)
  return surface === "drawer" ? (
    <DrawerTrigger {...(props as React.ComponentProps<typeof DrawerTrigger>)}>
      {children}
    </DrawerTrigger>
  ) : (
    <DialogTrigger {...props}>{children}</DialogTrigger>
  )
}

type MobileFriendlyDialogContentProps = Omit<
  React.ComponentProps<typeof DialogContent>,
  "className"
> & {
  className?: string
  dialogClassName?: string
  dialogOverlayClassName?: string
  drawerBackgroundClassName?: string
  drawerClassName?: string
  drawerOverlayClassName?: string
  drawerShowHandle?: boolean
  drawerShowOverlay?: boolean
}

function MobileFriendlyDialogContent({
  children,
  className,
  dialogClassName,
  dialogOverlayClassName,
  drawerBackgroundClassName,
  drawerClassName,
  drawerOverlayClassName,
  drawerShowHandle = true,
  drawerShowOverlay = true,
  showCloseButton = true,
  ...props
}: MobileFriendlyDialogContentProps) {
  const surface = React.useContext(MobileFriendlyDialogContext)

  if (surface === "drawer") {
    return (
      <DrawerContent
        {...(props as React.ComponentProps<typeof DrawerContent>)}
        backgroundClassName={drawerBackgroundClassName}
        className={cn(mobileFriendlyNoMotionClassName, className, drawerClassName)}
        overlayClassName={cn(mobileFriendlyNoMotionClassName, drawerOverlayClassName)}
        showHandle={drawerShowHandle}
        showOverlay={drawerShowOverlay}
      >
        {children}
        {showCloseButton ? (
          <DrawerClose asChild>
            <Button
              aria-label="Close"
              className="absolute top-4 right-4 z-50 bg-background/95"
              size="icon-sm"
              variant="ghost"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </DrawerClose>
        ) : null}
      </DrawerContent>
    )
  }

  return (
    <DialogContent
      {...props}
      className={cn(mobileFriendlyNoMotionClassName, className, dialogClassName)}
      overlayClassName={cn(mobileFriendlyNoMotionClassName, dialogOverlayClassName)}
      showCloseButton={showCloseButton}
    >
      {children}
    </DialogContent>
  )
}

function MobileFriendlyDialogHeader({
  children,
  ...props
}: React.ComponentProps<typeof DialogHeader>) {
  const surface = React.useContext(MobileFriendlyDialogContext)
  return surface === "drawer" ? (
    <DrawerHeader {...(props as React.ComponentProps<typeof DrawerHeader>)}>
      {children}
    </DrawerHeader>
  ) : (
    <DialogHeader {...props}>{children}</DialogHeader>
  )
}

function MobileFriendlyDialogFooter({
  children,
  ...props
}: React.ComponentProps<typeof DialogFooter>) {
  const surface = React.useContext(MobileFriendlyDialogContext)
  return surface === "drawer" ? (
    <DrawerFooter {...(props as React.ComponentProps<typeof DrawerFooter>)}>
      {children}
    </DrawerFooter>
  ) : (
    <DialogFooter {...props}>{children}</DialogFooter>
  )
}

function MobileFriendlyDialogTitle({
  children,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const surface = React.useContext(MobileFriendlyDialogContext)
  return surface === "drawer" ? (
    <DrawerTitle {...(props as React.ComponentProps<typeof DrawerTitle>)}>{children}</DrawerTitle>
  ) : (
    <DialogTitle {...props}>{children}</DialogTitle>
  )
}

function MobileFriendlyDialogDescription({
  children,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const surface = React.useContext(MobileFriendlyDialogContext)
  return surface === "drawer" ? (
    <DrawerDescription {...(props as React.ComponentProps<typeof DrawerDescription>)}>
      {children}
    </DrawerDescription>
  ) : (
    <DialogDescription {...props}>{children}</DialogDescription>
  )
}

type MobileFriendlyDialogCloseProps = React.ComponentProps<typeof DialogClose> & {
  render?: React.ReactElement
}

function MobileFriendlyDialogClose({ children, render, ...props }: MobileFriendlyDialogCloseProps) {
  const surface = React.useContext(MobileFriendlyDialogContext)

  if (surface === "drawer") {
    return render ? (
      <DrawerClose asChild>{React.cloneElement(render, undefined, children)}</DrawerClose>
    ) : (
      <DrawerClose {...(props as React.ComponentProps<typeof DrawerClose>)}>{children}</DrawerClose>
    )
  }

  return (
    <DialogClose render={render} {...props}>
      {children}
    </DialogClose>
  )
}

export {
  MobileFriendlyDialog,
  MobileFriendlyDialogClose,
  MobileFriendlyDialogContent,
  MobileFriendlyDialogDescription,
  MobileFriendlyDialogFooter,
  MobileFriendlyDialogHeader,
  MobileFriendlyDialogTitle,
  MobileFriendlyDialogTrigger,
}

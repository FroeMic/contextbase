import type { LucideProps } from "lucide-react"
import { X } from "lucide-react"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react"
import type { ComponentType, ReactElement, ReactNode } from "react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "./button"
import { cn } from "./cn"

export type MobileTabbarIcon = ComponentType<LucideProps>

export const mobileTabbarSpringTransition = {
  damping: 30,
  mass: 0.9,
  stiffness: 400,
  type: "spring",
} as const

const mobileTabbarContentTransition = {
  damping: 32,
  mass: 0.85,
  stiffness: 420,
  type: "spring",
} as const

export type MobileTabbarPanelItem = {
  active?: boolean
  disabled?: boolean
  icon: MobileTabbarIcon
  id: string
  label: string
  onSelect?: () => void
  render?: ReactElement
}

export type MobileTabbarItem =
  | {
      active?: boolean
      icon: MobileTabbarIcon
      id: string
      kind: "link"
      label: string
      onSelect?: () => void
      render: ReactElement
    }
  | {
      active?: boolean
      disabled?: boolean
      icon: MobileTabbarIcon
      id: string
      kind: "action"
      label: string
      onSelect: () => void
    }
  | {
      active?: boolean
      id: string
      kind: "custom"
      label: string
      render: ReactNode
    }
  | {
      active?: boolean
      icon: MobileTabbarIcon
      id: string
      items: MobileTabbarPanelItem[]
      kind: "group"
      label: string
      panelHeader?: ReactNode
      panelLabel?: string
    }

export function MobileTabbar({
  ariaLabel,
  className,
  dataSlot,
  items,
  panelClassName,
}: {
  ariaLabel: string
  className?: string
  dataSlot: string
  items: readonly MobileTabbarItem[]
  panelClassName?: string
}) {
  const [isMounted, setMounted] = useState(false)
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  const shouldReduceMotion = useReducedMotion()
  const shellTransition = shouldReduceMotion ? { duration: 0 } : mobileTabbarSpringTransition
  const contentTransition = shouldReduceMotion ? { duration: 0 } : mobileTabbarContentTransition
  const columnClassName = items.length >= 6 ? "grid-cols-6" : "grid-cols-5"
  const shellWidthClassName = items.length >= 6 ? "max-w-[24rem]" : "max-w-[20.5rem]"
  const openGroup = items.find(
    (item): item is Extract<MobileTabbarItem, { kind: "group" }> =>
      item.kind === "group" && item.id === openGroupId,
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!openGroup) return

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenGroupId(null)
    }

    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [openGroup])

  if (!isMounted) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-40 md:hidden" data-slot={dataSlot}>
      {openGroup ? (
        <button
          aria-label="Close navigation menu"
          className="pointer-events-auto absolute inset-0 cursor-default bg-transparent"
          onClick={() => setOpenGroupId(null)}
          type="button"
        />
      ) : null}
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-6 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className={cn("pointer-events-auto w-full", shellWidthClassName)}>
          <LayoutGroup id={dataSlot}>
            <AnimatePresence initial={false} mode="popLayout">
              {openGroup ? (
                <MobileTabbarGroupPanel
                  className={panelClassName}
                  contentTransition={contentTransition}
                  group={openGroup}
                  key={`group-${openGroup.id}`}
                  onClose={() => setOpenGroupId(null)}
                  shouldReduceMotion={shouldReduceMotion}
                  shellTransition={shellTransition}
                />
              ) : (
                <motion.nav
                  aria-label={ariaLabel}
                  className={cn(
                    "mx-auto grid h-16 items-center gap-1 overflow-hidden border border-border/70 bg-background/95 p-1.5 shadow-[0_22px_70px_rgb(0_0_0/0.18)] backdrop-blur-xl",
                    columnClassName,
                    className,
                  )}
                  key="tabbar"
                  layout
                  layoutId="mobile-tabbar-shell"
                  style={{ borderRadius: 32, originY: 1 }}
                  transition={shellTransition}
                >
                  {items.map((item) => (
                    <MobileTabbarButton item={item} key={item.id} onOpenGroup={setOpenGroupId} />
                  ))}
                </motion.nav>
              )}
            </AnimatePresence>
          </LayoutGroup>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function MobileTabbarGroupPanel({
  className,
  contentTransition,
  group,
  onClose,
  shellTransition,
  shouldReduceMotion,
}: {
  className?: string
  contentTransition: { duration: number } | typeof mobileTabbarContentTransition
  group: Extract<MobileTabbarItem, { kind: "group" }>
  onClose: () => void
  shellTransition: { duration: number } | typeof mobileTabbarSpringTransition
  shouldReduceMotion: boolean | null
}) {
  return (
    <motion.section
      aria-label={group.panelLabel ?? group.label}
      className={cn(
        "overflow-hidden border border-border/60 bg-background/95 shadow-[0_26px_80px_rgb(0_0_0/0.2)] backdrop-blur-xl",
        className,
      )}
      layout
      layoutId="mobile-tabbar-shell"
      style={{ borderRadius: 36, originY: 1 }}
      transition={shellTransition}
    >
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={
          shouldReduceMotion
            ? { opacity: 1 }
            : { filter: "blur(8px)", opacity: 0, scale: 0.96, y: 12 }
        }
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.92, y: 8 }}
        transition={contentTransition}
      >
        {group.panelHeader ? (
          <div className="flex items-center gap-3 border-b border-border/70 px-5 py-4">
            <div className="min-w-0 flex-1">{group.panelHeader}</div>
            <Button
              aria-label={`Close ${group.label} navigation`}
              className="rounded-full"
              onClick={onClose}
              size="icon"
              variant="ghost"
            >
              <X className="size-6" />
            </Button>
          </div>
        ) : null}
        <div className="grid gap-1 px-4 py-3">
          {group.items.map((item) => (
            <MobileTabbarPanelButton item={item} key={item.id} onNavigate={onClose} />
          ))}
        </div>
      </motion.div>
    </motion.section>
  )
}

function MobileTabbarButton({
  item,
  onOpenGroup,
}: {
  item: MobileTabbarItem
  onOpenGroup: (id: string) => void
}) {
  if (item.kind === "custom") return item.render

  const Icon = item.icon

  if (item.kind === "group") {
    return (
      <Button
        aria-expanded={false}
        aria-label={item.label}
        className={cn(
          "h-full min-w-0 rounded-full px-0",
          item.active && "bg-muted text-foreground",
        )}
        onClick={() => onOpenGroup(item.id)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Icon className="size-6" />
      </Button>
    )
  }

  if (item.kind === "action") {
    return (
      <Button
        aria-label={item.label}
        className={cn(
          "h-full min-w-0 rounded-full px-0",
          item.active && "bg-muted text-foreground",
        )}
        disabled={item.disabled}
        onClick={item.onSelect}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Icon className="size-6" />
      </Button>
    )
  }

  return (
    <Button
      aria-current={item.active ? "page" : undefined}
      aria-label={item.label}
      className={cn("h-full min-w-0 rounded-full px-0", item.active && "bg-muted text-foreground")}
      nativeButton={false}
      onClick={item.onSelect}
      render={item.render}
      size="sm"
      variant="ghost"
    >
      <Icon className="size-6" />
    </Button>
  )
}

function MobileTabbarPanelButton({
  item,
  onNavigate,
}: {
  item: MobileTabbarPanelItem
  onNavigate: () => void
}) {
  const Icon = item.icon
  const handleSelect = () => {
    item.onSelect?.()
    onNavigate()
  }

  return (
    <Button
      aria-current={item.active ? "page" : undefined}
      className={cn(
        "h-14 justify-start rounded-full px-4 text-lg",
        item.active && "bg-muted text-foreground",
      )}
      disabled={item.disabled}
      nativeButton={item.render ? false : undefined}
      onClick={handleSelect}
      render={item.render}
      variant="ghost"
    >
      <Icon className="size-6" />
      <span>{item.label}</span>
    </Button>
  )
}

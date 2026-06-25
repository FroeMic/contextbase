import type { DependencyList, ReactNode } from "react"
import { createContext, useContext, useEffect, useLayoutEffect } from "react"

export type AppFrameBottomDockMode = "default" | "hidden"
export type AppFrameContentPadding = "default" | "none"

export type AppFrameBreadcrumbItem = {
  href?: string
  label: string
}

export type AppFrameSlots = {
  bottomDockCenter?: ReactNode
  bottomDockEnd?: ReactNode
  bottomDockMode?: AppFrameBottomDockMode
  breadcrumbs?: AppFrameBreadcrumbItem[]
  contentPadding?: AppFrameContentPadding
  headerActions?: ReactNode
  routeContextActions?: ReactNode
  title?: string
}

export const defaultAppFrameSlots = {
  bottomDockMode: "default",
  contentPadding: "default",
} satisfies AppFrameSlots

export const AppFrameSlotsContext = createContext<AppFrameSlots>(defaultAppFrameSlots)

export const AppFrameSlotActionsContext = createContext<{
  clearSlots: () => void
  setSlots: (slots: AppFrameSlots) => void
} | null>(null)

export function mergeAppFrameSlots(slots?: AppFrameSlots | null) {
  return { ...defaultAppFrameSlots, ...(slots ?? {}) }
}

export function useAppFrameSlots() {
  return useContext(AppFrameSlotsContext)
}

export const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

export function useAppFrameSlotEffect(slots: AppFrameSlots, dependencies: DependencyList = []) {
  const actions = useContext(AppFrameSlotActionsContext)

  useIsomorphicLayoutEffect(() => {
    actions?.setSlots(slots)

    return () => {
      actions?.clearSlots()
    }
  }, [actions, ...dependencies])
}

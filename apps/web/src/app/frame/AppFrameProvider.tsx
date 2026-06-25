import type { ReactNode } from "react"
import { useMemo, useState } from "react"

import {
  type AppFrameBanner,
  AppFrameBannerActionsContext,
  AppFrameBannersContext,
} from "./app-frame-banners"
import {
  AppFrameSlotActionsContext,
  type AppFrameSlots,
  AppFrameSlotsContext,
  defaultAppFrameSlots,
  mergeAppFrameSlots,
} from "./app-frame-slots"

export function AppFrameProvider({
  banners = [],
  children,
  slotResetKey: _slotResetKey = "default",
  slots = defaultAppFrameSlots,
}: {
  banners?: readonly AppFrameBanner[]
  children: ReactNode
  slotResetKey?: string
  slots?: AppFrameSlots
}) {
  const [pageSlots, setPageSlots] = useState<AppFrameSlots>({})
  const [activeBanners, setActiveBanners] = useState<readonly AppFrameBanner[]>(banners)
  const activeSlots = useMemo(
    () => ({ ...mergeAppFrameSlots(slots), ...pageSlots }),
    [pageSlots, slots],
  )
  const slotActions = useMemo(
    () => ({
      clearSlots: () => setPageSlots({}),
      setSlots: (nextSlots: AppFrameSlots) => setPageSlots(nextSlots),
    }),
    [],
  )
  const bannerActions = useMemo(
    () => ({
      clearBanner: (id: string) =>
        setActiveBanners((currentBanners) => currentBanners.filter((banner) => banner.id !== id)),
      setBanner: (nextBanner: AppFrameBanner) =>
        setActiveBanners((currentBanners) => [
          ...currentBanners.filter((banner) => banner.id !== nextBanner.id),
          nextBanner,
        ]),
    }),
    [],
  )

  return (
    <AppFrameBannersContext.Provider value={activeBanners}>
      <AppFrameBannerActionsContext.Provider value={bannerActions}>
        <AppFrameSlotActionsContext.Provider value={slotActions}>
          <AppFrameSlotsContext.Provider value={{ ...defaultAppFrameSlots, ...activeSlots }}>
            {children}
          </AppFrameSlotsContext.Provider>
        </AppFrameSlotActionsContext.Provider>
      </AppFrameBannerActionsContext.Provider>
    </AppFrameBannersContext.Provider>
  )
}

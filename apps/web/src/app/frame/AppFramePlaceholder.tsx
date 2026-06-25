import { Sidebar, SidebarInset, SidebarProvider, SidebarTrigger } from "../../shared/ui/sidebar"
import { AppFrameBottomDock } from "./AppFrameBottomDock"
import { AppFrameContent } from "./AppFrameContent"
import { AppFrameHeader } from "./AppFrameHeader"
import { AppFrameHeightBanner } from "./AppFrameHeightBanner"
import { AppFrameProvider } from "./AppFrameProvider"
import { AppFrameStage } from "./AppFrameStage"
import { AppFrameViewport } from "./AppFrameViewport"

export function AppFramePlaceholder() {
  return (
    <AppFrameProvider>
      <SidebarProvider>
        <AppFrameViewport>
          <AppFrameHeightBanner />
          <AppFrameStage sidebar={<PlaceholderSidebar />}>
            <SidebarInset className="min-h-0 overflow-hidden bg-transparent md:peer-data-[variant=inset]:rounded-none md:peer-data-[variant=inset]:shadow-none">
              <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-background shadow-[0_1px_2px_rgb(0_0_0/0.03)]">
                <AppFrameHeader
                  start={<SidebarTrigger aria-label="Toggle sidebar" className="-ml-1" />}
                />
                <AppFrameContent>
                  <div aria-hidden="true" className="h-full min-h-0" />
                </AppFrameContent>
              </section>
              <AppFrameBottomDock />
            </SidebarInset>
          </AppFrameStage>
        </AppFrameViewport>
      </SidebarProvider>
    </AppFrameProvider>
  )
}

function PlaceholderSidebar() {
  return (
    <Sidebar className="absolute h-full" aria-hidden="true" collapsible="offcanvas" variant="inset">
      <div className="h-full bg-sidebar" />
    </Sidebar>
  )
}

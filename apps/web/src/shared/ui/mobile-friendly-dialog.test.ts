import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("MobileFriendlyDialog", () => {
  test("composes dialog and drawer primitives behind a mobile switch", () => {
    const source = readFileSync(join(process.cwd(), "src/shared/ui/mobile-friendly-dialog.tsx"), {
      encoding: "utf8",
      flag: "r",
    })

    expect(source).toContain("useIsMobile")
    expect(source).toContain("<Drawer")
    expect(source).toContain("<Dialog")
    expect(source).toContain("MobileFriendlyDialogContent")
    expect(source).toContain("MobileFriendlyDialogClose")
  })

  test("passes drawer handle control through to the drawer surface", () => {
    const source = readFileSync(join(process.cwd(), "src/shared/ui/mobile-friendly-dialog.tsx"), {
      encoding: "utf8",
      flag: "r",
    })

    expect(source).toContain("drawerShowHandle")
    expect(source).toContain("showHandle={drawerShowHandle}")
  })

  test("lets mobile drawers replace the default dark overlay with a light background layer", () => {
    const source = readFileSync(join(process.cwd(), "src/shared/ui/mobile-friendly-dialog.tsx"), {
      encoding: "utf8",
      flag: "r",
    })
    const drawerSource = readFileSync(join(process.cwd(), "src/shared/ui/drawer.tsx"), {
      encoding: "utf8",
      flag: "r",
    })

    expect(source).toContain("drawerShowOverlay")
    expect(source).toContain("drawerBackgroundClassName")
    expect(source).toContain("showOverlay={drawerShowOverlay}")
    expect(source).toContain("backgroundClassName={drawerBackgroundClassName}")
    expect(drawerSource).toContain("backgroundClassName")
    expect(drawerSource).toContain('data-slot="drawer-background"')
    expect(drawerSource).toContain("pointer-events-none fixed inset-0 z-40")
  })

  test("lets mobile drawers opt into a full-screen surface", () => {
    const source = readFileSync(join(process.cwd(), "src/shared/ui/mobile-friendly-dialog.tsx"), {
      encoding: "utf8",
      flag: "r",
    })

    expect(source).toContain("drawerClassName")
    expect(source).toContain("drawerShowHandle")
  })

  test("disables dialog and drawer open animations by default", () => {
    const source = readFileSync(join(process.cwd(), "src/shared/ui/mobile-friendly-dialog.tsx"), {
      encoding: "utf8",
      flag: "r",
    })
    const dialogSource = readFileSync(join(process.cwd(), "src/shared/ui/dialog.tsx"), {
      encoding: "utf8",
      flag: "r",
    })

    expect(source).toContain("mobileFriendlyNoMotionClassName")
    expect(source).toContain("overlayClassName={cn(mobileFriendlyNoMotionClassName")
    expect(source).toContain("className={cn(mobileFriendlyNoMotionClassName")
    expect(source).toContain("drawerOverlayClassName")
    expect(dialogSource).toContain("overlayClassName")
  })
})

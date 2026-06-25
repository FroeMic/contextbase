import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

import {
  createDatatableMobileDrawerStack,
  getCurrentDatatableMobileDrawerEntry,
  popDatatableMobileDrawerStack,
  pushDatatableMobileDrawerStack,
  replaceDatatableMobileDrawerStack,
} from "./datatable-mobile-drawer-navigation"

type TestPageId = "root" | "child" | "replacement"

type TestPageParams = {
  child: { id: string }
  replacement: { reason: string }
  root: Record<string, never>
}

describe("DatatableMobileDrawerNavigator", () => {
  test("manages a typed page stack with push, pop, replace, and reset helpers", () => {
    const rootStack = createDatatableMobileDrawerStack<TestPageId, TestPageParams>("root", {})

    expect(getCurrentDatatableMobileDrawerEntry(rootStack)).toMatchObject({
      pageId: "root",
      params: {},
    })

    const childStack = pushDatatableMobileDrawerStack(rootStack, "child", { id: "status" })

    expect(childStack).toHaveLength(2)
    expect(getCurrentDatatableMobileDrawerEntry(childStack)).toMatchObject({
      pageId: "child",
      params: { id: "status" },
    })

    const replacementStack = replaceDatatableMobileDrawerStack(childStack, "replacement", {
      reason: "selected",
    })

    expect(replacementStack).toHaveLength(2)
    expect(getCurrentDatatableMobileDrawerEntry(replacementStack)).toMatchObject({
      pageId: "replacement",
      params: { reason: "selected" },
    })

    const poppedStack = popDatatableMobileDrawerStack(replacementStack)

    expect(poppedStack).toHaveLength(1)
    expect(getCurrentDatatableMobileDrawerEntry(poppedStack)).toMatchObject({
      pageId: "root",
      params: {},
    })
    expect(popDatatableMobileDrawerStack(poppedStack)).toEqual(poppedStack)
  })

  test("uses nested Vaul drawers for stacked mobile pages without custom keyboard geometry", () => {
    const sourcePath = join(
      process.cwd(),
      "src/react-datatable/components/mobile/DatatableMobileDrawerNavigator.tsx",
    )

    expect(existsSync(sourcePath)).toBe(true)

    const source = readFileSync(sourcePath, "utf8")

    expect(source).toContain("@/shared/ui/drawer")
    expect(source).toContain("<Drawer")
    expect(source).toContain("<DrawerNestedRoot")
    expect(source).toContain("<DrawerContent")
    expect(source).toContain("nestedEntry")
    expect(source).not.toContain("stack.slice(1).map")
    expect(source).toContain("<DrawerTitle")
    expect(source).toContain("<DrawerDescription")
    expect(source).toContain('aria-label="Back"')
    expect(source).toContain('effectiveCloseIcon === "check" ? "Done" : "Close"')
    expect(source).toContain("setHeaderAction")
    expect(source).toContain("headerAction?.disabled")
    expect(source).toContain("headerAction?.onClick")
    expect(source).toContain("data-[vaul-drawer-direction=bottom]:mt-0")
    expect(source).toContain("data-[vaul-drawer-direction=bottom]:h-svh")
    expect(source).toContain("data-[vaul-drawer-direction=bottom]:max-h-svh")
    expect(source).not.toContain("--rdt-mobile-drawer-height")
    expect(source).not.toContain("blurActiveEditableElement")
    expect(source).not.toContain("deferNavigationUntilKeyboardSettles")
    expect(source).not.toContain("slide-in-from-right")
    expect(source).not.toContain("slide-in-from-left")
    expect(source).toContain("size-6")
    expect(source).not.toContain("size-5")
    expect(source).toContain("text-base")
    expect(source).toContain("showOverlay={false}")
  })

  test("suppresses table row clicks while interacting with mobile drawer content", () => {
    const sourcePath = join(
      process.cwd(),
      "src/react-datatable/components/mobile/DatatableMobileDrawerNavigator.tsx",
    )
    const source = readFileSync(sourcePath, "utf8")

    expect(source).toContain('from "@/shared/ui/row-click-suppression"')
    expect(source).toContain("onPointerDownCapture={() => suppressRowClick")
    expect(source).toContain("onClickCapture={() => suppressRowClick")
  })
})

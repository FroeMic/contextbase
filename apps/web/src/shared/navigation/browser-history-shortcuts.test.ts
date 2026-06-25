import { describe, expect, test } from "vitest"

import { getBrowserHistoryShortcutAction } from "./browser-history-shortcuts"

function shortcutEvent(overrides: Partial<Parameters<typeof getBrowserHistoryShortcutAction>[0]>) {
  return {
    altKey: false,
    ctrlKey: false,
    defaultPrevented: false,
    key: "ArrowLeft",
    metaKey: true,
    shiftKey: false,
    target: null,
    ...overrides,
  }
}

describe("browser history shortcuts", () => {
  test("maps Cmd+ArrowLeft and Cmd+ArrowRight to browser history actions", () => {
    expect(getBrowserHistoryShortcutAction(shortcutEvent({ key: "ArrowLeft" }))).toBe("back")
    expect(getBrowserHistoryShortcutAction(shortcutEvent({ key: "ArrowRight" }))).toBe("forward")
  })

  test("ignores non-Cmd and modified arrow key presses", () => {
    expect(getBrowserHistoryShortcutAction(shortcutEvent({ metaKey: false }))).toBeNull()
    expect(getBrowserHistoryShortcutAction(shortcutEvent({ ctrlKey: true }))).toBeNull()
    expect(getBrowserHistoryShortcutAction(shortcutEvent({ altKey: true }))).toBeNull()
    expect(getBrowserHistoryShortcutAction(shortcutEvent({ shiftKey: true }))).toBeNull()
    expect(getBrowserHistoryShortcutAction(shortcutEvent({ key: "ArrowUp" }))).toBeNull()
  })

  test("does not hijack already-handled events or text editing targets", () => {
    const editableTarget = {
      closest: (selector: string) => (selector.includes("input") ? ({} as Element) : null),
      isContentEditable: false,
    } as unknown as EventTarget

    expect(getBrowserHistoryShortcutAction(shortcutEvent({ defaultPrevented: true }))).toBeNull()
    expect(getBrowserHistoryShortcutAction(shortcutEvent({ target: editableTarget }))).toBeNull()
  })
})

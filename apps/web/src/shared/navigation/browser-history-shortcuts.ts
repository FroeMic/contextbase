export type BrowserHistoryShortcutAction = "back" | "forward"

type KeyboardShortcutEvent = Pick<
  KeyboardEvent,
  "altKey" | "ctrlKey" | "defaultPrevented" | "key" | "metaKey" | "shiftKey"
> & {
  target: EventTarget | null
}

const EDITABLE_TARGET_SELECTOR =
  "input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='textbox']"

export function getBrowserHistoryShortcutAction(
  event: KeyboardShortcutEvent,
): BrowserHistoryShortcutAction | null {
  if (
    event.defaultPrevented ||
    !event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey ||
    isEditableTarget(event.target)
  ) {
    return null
  }

  if (event.key === "ArrowLeft") {
    return "back"
  }

  if (event.key === "ArrowRight") {
    return "forward"
  }

  return null
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") {
    return false
  }

  const targetElement = target as {
    closest?: (selector: string) => Element | null
    isContentEditable?: boolean
  }

  return Boolean(
    targetElement.isContentEditable || targetElement.closest?.(EDITABLE_TARGET_SELECTOR),
  )
}

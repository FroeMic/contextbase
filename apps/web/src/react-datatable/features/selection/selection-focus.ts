function isEditableElement(element: Element | null) {
  if (!element || typeof element !== "object") {
    return false
  }

  const maybeElement = element as Element & {
    tagName?: string
    isContentEditable?: boolean
    closest?: (selector: string) => Element | null
  }
  const tagName = maybeElement.tagName

  if (
    maybeElement.isContentEditable === true ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  ) {
    return true
  }

  return Boolean(
    maybeElement.closest?.(
      '[contenteditable="true"], [role="textbox"], [role="searchbox"], [role="combobox"], [role="spinbutton"]',
    ),
  )
}

function toElement(target: EventTarget | null): Element | null {
  if (!target || typeof target !== "object") {
    return null
  }

  return target as Element
}

export function shouldAutofocusInteractiveGrid({
  interactionEnabled,
  activeElement,
  gridElement,
}: {
  interactionEnabled: boolean
  activeElement: Element | null
  gridElement: HTMLElement | null
}) {
  if (!interactionEnabled || !gridElement) {
    return false
  }

  if (!activeElement) {
    return true
  }

  if (activeElement === gridElement || gridElement.contains(activeElement)) {
    return false
  }

  if (isEditableElement(activeElement)) {
    return false
  }

  return true
}

export function shouldHandleDocumentGridNavigation({
  key,
  metaKey,
  ctrlKey,
  altKey,
  keyboardNavigationEnabled,
  hasNavigationAnchor,
  hasHoveredRowAnchor = false,
  target,
  gridElement,
}: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  keyboardNavigationEnabled: boolean
  hasNavigationAnchor: boolean
  hasHoveredRowAnchor?: boolean
  target: EventTarget | null
  gridElement: HTMLElement | null
}) {
  if (
    !keyboardNavigationEnabled ||
    !gridElement ||
    (!hasNavigationAnchor && !hasHoveredRowAnchor)
  ) {
    return false
  }

  if (key !== "ArrowDown" && key !== "ArrowUp" && key !== " " && key !== "Space") {
    return false
  }

  if ((key === " " || key === "Space") && !hasHoveredRowAnchor) {
    return false
  }

  if (metaKey || ctrlKey || altKey) {
    return false
  }

  return !isEditableElement(toElement(target))
}

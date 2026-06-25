export const pageHintResetEventName = "contextbase:page-hints:reset"

export function dispatchPageHintReset(namespace: string) {
  getWindow()?.dispatchEvent(new CustomEvent(pageHintResetEventName, { detail: { namespace } }))
}

export function isPageHintResetEventForNamespace(event: Event, namespace: string) {
  return event instanceof CustomEvent && event.detail?.namespace === namespace
}

function getWindow(): Window | null {
  return typeof window === "undefined" ? null : window
}

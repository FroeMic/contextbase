import {
  AUTOMATIC_SESSION_OBSERVED,
  type AutomaticObservationReason,
  withAutomaticObservation,
} from "../automatic-sync"
import { EXTRACT_CURRENT_SESSION, type ExtractCurrentSessionMessage } from "../extension-flow"
import { extractChatGptSession } from "../providers/chatgpt"

const INITIAL_OBSERVATION_DELAY_MS = 1_000
const OBSERVATION_DEBOUNCE_MS = 750

chrome.runtime.onMessage.addListener(
  (message: ExtractCurrentSessionMessage, _sender, sendResponse: (response: unknown) => void) => {
    if (message.type !== EXTRACT_CURRENT_SESSION) return false

    Promise.resolve(extractChatGptSession(document, new URL(window.location.href)))
      .then((extracted) => {
        sendResponse({
          extracted,
          ok: true,
        })
      })
      .catch((error) => {
        sendResponse({
          error: error instanceof Error ? error.message : "Failed to extract ChatGPT session",
          ok: false,
        })
      })

    return true
  },
)

startAutomaticObservation()

function startAutomaticObservation() {
  let timer: ReturnType<typeof setTimeout> | undefined

  const schedule = (reason: AutomaticObservationReason) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      void sendAutomaticObservation(reason)
    }, OBSERVATION_DEBOUNCE_MS)
  }

  setTimeout(() => schedule("initial_load"), INITIAL_OBSERVATION_DELAY_MS)

  const observer = new MutationObserver(() => schedule("mutation"))
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })

  window.addEventListener("scroll", () => schedule("scroll"), { passive: true })
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") schedule("mutation")
  })
}

async function sendAutomaticObservation(reason: AutomaticObservationReason) {
  try {
    const extracted = withAutomaticObservation(
      extractChatGptSession(document, new URL(window.location.href)),
      reason,
      detectCoverageBoundaries(),
    )
    await chrome.runtime.sendMessage({
      extracted,
      type: AUTOMATIC_SESSION_OBSERVED,
    })
  } catch {
    // Provider markup can be transient during navigation; the next observation will retry.
  }
}

function detectCoverageBoundaries() {
  const scrollElement = document.scrollingElement ?? document.documentElement
  const distanceFromBottom =
    scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight

  return {
    latestBoundarySeen: distanceFromBottom <= 8,
    oldestBoundarySeen: scrollElement.scrollTop <= 8,
  }
}

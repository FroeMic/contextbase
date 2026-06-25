import { LightbulbIcon } from "lucide-react"

import { Button } from "../ui/button"
import type { PageHint } from "./page-hint-model"
import { dispatchPageHintReset } from "./page-hint-reset-event"
import {
  clearDismissedPageHintKeys,
  localStoragePageHintStorage,
  type PageHintStorage,
} from "./page-hint-storage"

export function PageHintTipsButton({
  hints,
  storage = localStoragePageHintStorage,
  storageNamespace,
}: {
  hints: readonly PageHint[]
  storage?: PageHintStorage
  storageNamespace: string
}) {
  if (hints.length === 0) return null

  function resetPageHints() {
    clearDismissedPageHintKeys(storage, storageNamespace)
    dispatchPageHintReset(storageNamespace)
  }

  return (
    <Button
      className="text-muted-foreground hover:text-foreground"
      onClick={resetPageHints}
      size="xs"
      title="Show page tips"
      type="button"
      variant="ghost"
    >
      <LightbulbIcon className="size-3.5" />
      Show Tips
    </Button>
  )
}

export type EventHandler<TEvent> = (event: TEvent) => void

export function composeEventHandlers<TEvent>(
  existingHandler: EventHandler<TEvent> | undefined,
  intentHandler: EventHandler<TEvent> | undefined,
): EventHandler<TEvent> | undefined {
  if (!existingHandler) return intentHandler
  if (!intentHandler) return existingHandler

  return (event) => {
    existingHandler(event)
    intentHandler(event)
  }
}

export function isSelectionSelectAllShortcut({
  key,
  metaKey,
  ctrlKey,
  altKey,
  selectionEnabled,
}: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  selectionEnabled: boolean
}) {
  if (!selectionEnabled) {
    return false
  }

  if (altKey) {
    return false
  }

  if (!metaKey && !ctrlKey) {
    return false
  }

  return key.toLowerCase() === "a"
}

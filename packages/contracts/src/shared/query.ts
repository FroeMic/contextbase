export function parseCommaSeparatedValues(value: string | readonly string[] | undefined) {
  if (value === undefined) return []
  const values = Array.isArray(value) ? value : [value]
  return values
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean)
}

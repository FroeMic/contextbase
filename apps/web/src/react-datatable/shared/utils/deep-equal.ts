/**
 * Zero-dependency deep equality comparison
 *
 * Handles:
 * - Primitives (string, number, boolean, null, undefined)
 * - Objects (plain objects only)
 * - Arrays
 * - Dates
 * - RegExp
 *
 * Does NOT handle:
 * - Functions (returns false)
 * - Symbols (returns false)
 * - Map/Set/WeakMap/WeakSet (returns false)
 * - Circular references (will cause stack overflow)
 *
 * Performance: O(n) where n is total number of properties
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  // Same reference (includes NaN === NaN via Object.is)
  if (Object.is(a, b)) {
    return true
  }

  // Different types or one is null/undefined
  if (typeof a !== typeof b || a === null || b === null) {
    return false
  }

  // Dates
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }

  // RegExp
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags
  }

  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false
    }

    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false
      }
    }

    return true
  }

  // Objects (plain objects only)
  if (typeof a === "object" && typeof b === "object") {
    // Reject non-plain objects (Map, Set, etc.)
    if (a.constructor !== Object || b.constructor !== Object) {
      return false
    }

    const keysA = Object.keys(a as object)
    const keysB = Object.keys(b as object)

    if (keysA.length !== keysB.length) {
      return false
    }

    // Sort keys for deterministic comparison
    // This handles {a:1, b:2} === {b:2, a:1}
    keysA.sort()
    keysB.sort()

    // Check keys are the same
    for (let i = 0; i < keysA.length; i++) {
      if (keysA[i] !== keysB[i]) {
        return false
      }
    }

    // Check values
    for (const key of keysA) {
      if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
        return false
      }
    }

    return true
  }

  // Functions, Symbols, etc. - not supported
  return false
}

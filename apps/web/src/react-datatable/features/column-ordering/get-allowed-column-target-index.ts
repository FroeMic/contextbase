interface GetAllowedColumnTargetIndexArgs {
  sourceIndex: number
  targetIndex: number
  frozenColumnsCount: number
  allowFrozenBoundaryCrossing: boolean
}

export function getAllowedColumnTargetIndex({
  sourceIndex,
  targetIndex,
  frozenColumnsCount,
  allowFrozenBoundaryCrossing,
}: GetAllowedColumnTargetIndexArgs): number {
  if (allowFrozenBoundaryCrossing || frozenColumnsCount <= 0) {
    return targetIndex
  }

  const isSourceFrozen = sourceIndex < frozenColumnsCount

  if (isSourceFrozen) {
    return Math.min(targetIndex, frozenColumnsCount - 1)
  }

  return Math.max(targetIndex, frozenColumnsCount)
}

export type GenerationItemStatus = "queued" | "generating" | "completed" | "failed"

export type GenerationItemState = {
  id: string
  jobId: string
  position: number
  status: GenerationItemStatus
  outputAssetId?: string
}

export type GenerationItemSummary = Record<GenerationItemStatus, number> & {
  total: number
}

export function createMockGenerationItems(input: {
  jobId: string
  count: number
}): GenerationItemState[] {
  return Array.from({ length: input.count }, (_, index) => ({
    id: `${input.jobId}_item_${index + 1}`,
    jobId: input.jobId,
    position: index + 1,
    status: "queued",
  }))
}

export function markGenerationItemCompleted(
  item: GenerationItemState,
  outputAssetId: string,
): GenerationItemState {
  return {
    ...item,
    status: "completed",
    outputAssetId,
  }
}

export function summarizeGenerationItems(
  items: readonly GenerationItemState[],
): GenerationItemSummary {
  return items.reduce<GenerationItemSummary>(
    (summary, item) => {
      summary[item.status] += 1
      summary.total += 1
      return summary
    },
    {
      total: 0,
      queued: 0,
      generating: 0,
      completed: 0,
      failed: 0,
    },
  )
}

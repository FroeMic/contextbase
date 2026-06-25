import type { OnlineGroupingSummary } from "../../types/props.types"

export function createOnlineGroupingSummaryCountGetter(
  summary: OnlineGroupingSummary | undefined,
): ((groupId: string) => number | undefined) | undefined {
  if (!summary) {
    return undefined
  }

  const counts = new Map<string, number>()

  for (const [groupId, group] of Object.entries(summary.groups)) {
    counts.set(groupId, group.total)

    for (const [subgroupId, subgroup] of Object.entries(group.subgroups ?? {})) {
      counts.set(subgroupId, subgroup.total)
    }
  }

  return (groupId) => counts.get(groupId)
}

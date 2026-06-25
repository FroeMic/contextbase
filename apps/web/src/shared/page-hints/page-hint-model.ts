import type { CSSProperties } from "react"

export type PageHint = {
  actionLabel?: string
  description: string
  key: string
  title: string
}

type PageHintStackItemStyle = CSSProperties & {
  "--page-hint-expanded-y": string
  "--page-hint-opacity": string
  "--page-hint-scale-x": string
  "--page-hint-y": string
}

export type PageHintStackItem = {
  ariaHidden: boolean
  hint: PageHint
  index: number
  isInteractive: boolean
  isTop: boolean
  style: PageHintStackItemStyle
  zIndex: number
}

const DEFAULT_VISIBLE_HINT_LIMIT = 3
const STACK_COLLAPSED_OFFSET_PX = 14
const STACK_EXPANDED_GAP_PX = 6
const STACK_EXPANDED_STEP = "100% + 0.375rem"
const STACK_SCALE_STEP = 0.1

export function visiblePageHints(hints: readonly PageHint[], dismissedKeys: ReadonlySet<string>) {
  return hints.filter((hint) => !dismissedKeys.has(hint.key))
}

export function getPageHintStackItems(
  hints: readonly PageHint[],
  limit = DEFAULT_VISIBLE_HINT_LIMIT,
  cardHeights: Readonly<Record<string, number>> = {},
): PageHintStackItem[] {
  const visibleHints = hints.slice(0, limit)
  const frontCardHeight = cardHeights[visibleHints[0]?.key ?? ""] ?? 0

  return visibleHints.map((hint, index) => {
    const zIndex = visibleHints.length - index
    const scale = Number((1 - index * STACK_SCALE_STEP).toFixed(3))
    const cardHeight = cardHeights[hint.key] ?? 0
    const collapsedY =
      frontCardHeight > 0 && cardHeight > 0
        ? cardHeight - frontCardHeight - index * STACK_COLLAPSED_OFFSET_PX
        : index * -STACK_COLLAPSED_OFFSET_PX
    const style: PageHintStackItemStyle = {
      "--page-hint-expanded-y": index === 0 ? "0px" : `calc(-${index} * (${STACK_EXPANDED_STEP}))`,
      "--page-hint-opacity": "1",
      "--page-hint-scale-x": String(scale),
      "--page-hint-y": `${collapsedY}px`,
      zIndex,
    }

    return {
      ariaHidden: false,
      hint,
      index,
      isInteractive: true,
      isTop: index === 0,
      style,
      zIndex,
    }
  })
}

export function getMeasuredPageHintExpandedY(
  items: readonly Pick<PageHintStackItem, "hint">[],
  cardHeights: Readonly<Record<string, number>>,
  gapPx = STACK_EXPANDED_GAP_PX,
) {
  let offsetPx = 0

  return items.reduce<Record<string, string>>((expandedYByHintKey, item, index) => {
    expandedYByHintKey[item.hint.key] = offsetPx === 0 ? "0px" : `-${offsetPx}px`
    offsetPx += (cardHeights[item.hint.key] ?? 0) + (index === items.length - 1 ? 0 : gapPx)

    return expandedYByHintKey
  }, {})
}

export function getMeasuredPageHintCollapsedStackHeight(
  items: readonly Pick<PageHintStackItem, "hint">[],
  cardHeights: Readonly<Record<string, number>>,
  collapsedOffsetPx = STACK_COLLAPSED_OFFSET_PX,
) {
  const frontCardHeight = cardHeights[items[0]?.hint.key ?? ""] ?? 0
  if (frontCardHeight === 0) return "24rem"

  return `${frontCardHeight + Math.max(0, items.length - 1) * collapsedOffsetPx}px`
}

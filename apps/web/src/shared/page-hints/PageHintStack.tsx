import { LightbulbIcon } from "lucide-react"
import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import { Button } from "../ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card"
import { cn } from "../ui/cn"
import {
  getMeasuredPageHintCollapsedStackHeight,
  getMeasuredPageHintExpandedY,
  getPageHintStackItems,
  type PageHint,
  type PageHintStackItem,
  visiblePageHints,
} from "./page-hint-model"
import { isPageHintResetEventForNamespace, pageHintResetEventName } from "./page-hint-reset-event"
import {
  dismissPageHintKey,
  localStoragePageHintStorage,
  type PageHintStorage,
  readDismissedPageHintKeys,
} from "./page-hint-storage"

const DISMISS_ANIMATION_MS = 180
const STACK_COLLAPSE_CLIP_DELAY_MS = 300
type PageHintCardHeights = Record<string, number>

export function PageHintStack({
  className,
  hints,
  maxVisible = 3,
  storage = localStoragePageHintStorage,
  storageNamespace,
}: {
  className?: string
  hints: readonly PageHint[]
  maxVisible?: number
  storage?: PageHintStorage
  storageNamespace: string
}) {
  const cardRefs = useRef(new Map<string, HTMLDivElement>())
  const collapseClipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [cardHeights, setCardHeights] = useState<PageHintCardHeights>({})
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => new Set())
  const [dismissingKey, setDismissingKey] = useState<string | null>(null)
  const [isStackClipDeferred, setIsStackClipDeferred] = useState(false)
  const [isStackExpanded, setIsStackExpanded] = useState(false)

  useEffect(() => {
    setDismissedKeys(readDismissedPageHintKeys(storage, storageNamespace))
  }, [storage, storageNamespace])

  useEffect(() => {
    function resetPageHints(event: Event) {
      if (!isPageHintResetEventForNamespace(event, storageNamespace)) return
      setDismissingKey(null)
      setDismissedKeys(new Set())
    }

    window.addEventListener(pageHintResetEventName, resetPageHints)

    return () => {
      window.removeEventListener(pageHintResetEventName, resetPageHints)
    }
  }, [storageNamespace])

  useEffect(
    () => () => {
      if (collapseClipTimeoutRef.current) clearTimeout(collapseClipTimeoutRef.current)
      if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current)
    },
    [],
  )

  const visibleHints = useMemo(() => visiblePageHints(hints, dismissedKeys), [dismissedKeys, hints])
  const items = useMemo(
    () => getPageHintStackItems(visibleHints, maxVisible, cardHeights),
    [cardHeights, maxVisible, visibleHints],
  )
  const expandedYByHintKey = useMemo(
    () => getMeasuredPageHintExpandedY(items, cardHeights),
    [cardHeights, items],
  )
  const collapsedStackHeight = useMemo(
    () => getMeasuredPageHintCollapsedStackHeight(items, cardHeights),
    [cardHeights, items],
  )

  useLayoutEffect(() => {
    function measureCardHeights() {
      const nextCardHeights = readPageHintCardHeights(items, cardRefs.current)

      setCardHeights((currentCardHeights) =>
        arePageHintCardHeightsEqual(currentCardHeights, nextCardHeights)
          ? currentCardHeights
          : nextCardHeights,
      )
    }

    measureCardHeights()

    if (typeof ResizeObserver === "undefined") return

    const resizeObserver = new ResizeObserver(measureCardHeights)

    for (const item of items) {
      const node = cardRefs.current.get(item.hint.key)
      if (node) resizeObserver.observe(node)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [items])

  if (items.length === 0) return null

  function dismissHint(hintKey: string) {
    if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current)
    setDismissingKey(hintKey)
    dismissTimeoutRef.current = setTimeout(() => {
      dismissPageHintKey(storage, storageNamespace, hintKey)
      setDismissedKeys((current) => new Set(current).add(hintKey))
      setDismissingKey(null)
    }, DISMISS_ANIMATION_MS)
  }

  function expandPageHints() {
    if (collapseClipTimeoutRef.current) clearTimeout(collapseClipTimeoutRef.current)
    setIsStackClipDeferred(false)
    setIsStackExpanded(true)
  }

  function collapsePageHints() {
    if (collapseClipTimeoutRef.current) clearTimeout(collapseClipTimeoutRef.current)
    setIsStackExpanded(false)
    setIsStackClipDeferred(true)
    collapseClipTimeoutRef.current = setTimeout(() => {
      setIsStackClipDeferred(false)
    }, STACK_COLLAPSE_CLIP_DELAY_MS)
  }

  const [topItem, ...backgroundItems] = items
  const isStackClipOpen = isStackExpanded || isStackClipDeferred

  function renderHintCard(item: PageHintStackItem) {
    const isDismissing = item.hint.key === dismissingKey
    const style = isDismissing
      ? ({
          ...item.style,
          "--page-hint-opacity": "0.8",
          "--page-hint-scale-x": "1",
          "--page-hint-y": "120%",
        } as typeof item.style)
      : ({
          ...item.style,
          "--page-hint-expanded-y": expandedYByHintKey[item.hint.key],
        } as typeof item.style)

    return (
      <Card
        aria-hidden={item.ariaHidden}
        className={cn(
          "absolute right-2 bottom-0 left-2 w-auto origin-bottom translate-y-[var(--page-hint-y)] scale-x-[var(--page-hint-scale-x)] gap-0 rounded-xl border-border/70 bg-popover py-0 text-popover-foreground opacity-[var(--page-hint-opacity)] shadow-[0_1px_2px_rgb(0_0_0/0.02)] backdrop-blur transition-all duration-300 ease-out motion-reduce:transition-none",
          !isDismissing &&
            "group-hover/page-hints:translate-y-[var(--page-hint-expanded-y)] group-hover/page-hints:scale-x-100 group-hover/page-hints:opacity-100",
          item.isTop
            ? "pointer-events-auto"
            : "pointer-events-none group-hover/page-hints:pointer-events-auto",
        )}
        key={item.hint.key}
        ref={(node) => {
          if (node) {
            cardRefs.current.set(item.hint.key, node)
          } else {
            cardRefs.current.delete(item.hint.key)
          }
        }}
        size="sm"
        style={style}
      >
        <CardHeader className="gap-1.5 px-4 pt-3 pb-1.5">
          <div className="flex items-center gap-2">
            <LightbulbIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <CardTitle className="text-sm leading-5">{item.hint.title}</CardTitle>
          </div>
          <CardDescription className="text-[13px] leading-5">
            {item.hint.description}
          </CardDescription>
        </CardHeader>
        {item.isInteractive ? (
          <CardFooter className="justify-end px-4 pt-0 pb-2.5">
            <Button
              onClick={() => dismissHint(item.hint.key)}
              size="xs"
              type="button"
              variant="secondary"
            >
              {item.hint.actionLabel ?? "Got it"}
            </Button>
          </CardFooter>
        ) : null}
      </Card>
    )
  }

  return (
    <aside
      aria-label="Page guidance"
      className={cn(
        "pointer-events-none group/page-hints absolute right-5 bottom-28 md:bottom-5 z-30 h-[24rem] w-[min(22rem,calc(100vw-2.5rem))]",
        className,
      )}
      onMouseEnter={expandPageHints}
      onMouseLeave={collapsePageHints}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 z-0 h-[42rem] w-full group-hover/page-hints:pointer-events-auto"
      />
      <div
        className={cn(
          "pointer-events-none absolute bottom-0 -left-2 z-0 w-[calc(100%+1rem)]",
          isStackClipOpen
            ? "h-[42rem] overflow-hidden"
            : "h-[calc(var(--page-hint-collapsed-stack-height)+0.5rem)] overflow-hidden",
        )}
        style={
          {
            "--page-hint-collapsed-stack-height": collapsedStackHeight,
          } as CSSProperties
        }
      >
        {backgroundItems.map(renderHintCard)}
      </div>
      <div className="pointer-events-none absolute bottom-0 -left-2 z-10 overflow-visible h-[42rem] w-[calc(100%+1rem)]">
        {topItem ? renderHintCard(topItem) : null}
      </div>
    </aside>
  )
}

function readPageHintCardHeights(
  items: readonly Pick<PageHintStackItem, "hint">[],
  cardRefs: ReadonlyMap<string, HTMLElement>,
) {
  return items.reduce<PageHintCardHeights>((cardHeights, item) => {
    const node = cardRefs.get(item.hint.key)
    cardHeights[item.hint.key] = node?.offsetHeight ?? 0

    return cardHeights
  }, {})
}

function arePageHintCardHeightsEqual(
  firstCardHeights: Readonly<PageHintCardHeights>,
  secondCardHeights: Readonly<PageHintCardHeights>,
) {
  const firstKeys = Object.keys(firstCardHeights)
  const secondKeys = Object.keys(secondCardHeights)

  if (firstKeys.length !== secondKeys.length) return false

  return firstKeys.every((key) => firstCardHeights[key] === secondCardHeights[key])
}

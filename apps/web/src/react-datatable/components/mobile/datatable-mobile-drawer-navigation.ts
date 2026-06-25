import type { ReactNode } from "react"

export type DatatableMobileDrawerNavigationDirection = "back" | "forward"

export type DatatableMobileDrawerStackEntry<
  TPageId extends string,
  TParamsByPage extends Record<TPageId, unknown>,
> = {
  key: string
  pageId: TPageId
  params: TParamsByPage[TPageId]
}

export type DatatableMobileDrawerPageDefinition<
  TPageId extends string,
  TParamsByPage extends Record<TPageId, unknown>,
> = {
  closeIcon?: (params: TParamsByPage[TPageId]) => "check" | "close"
  description?: (params: TParamsByPage[TPageId]) => string
  id: TPageId
  render: (
    context: DatatableMobileDrawerPageRenderContext<TPageId, TParamsByPage>,
    params: TParamsByPage[TPageId],
  ) => ReactNode
  title: (params: TParamsByPage[TPageId]) => ReactNode
}

export type DatatableMobileDrawerHeaderAction = {
  disabled?: boolean
  icon?: "check" | "close"
  label: string
  onClick: () => void
}

export type DatatableMobileDrawerPageRenderContext<
  TPageId extends string,
  TParamsByPage extends Record<TPageId, unknown>,
> = {
  close: () => void
  currentPageId: TPageId
  depth: number
  pop: () => void
  push: <TNextPageId extends TPageId>(
    pageId: TNextPageId,
    params: TParamsByPage[TNextPageId],
  ) => void
  replace: <TNextPageId extends TPageId>(
    pageId: TNextPageId,
    params: TParamsByPage[TNextPageId],
  ) => void
  reset: () => void
  setHeaderAction: (action: DatatableMobileDrawerHeaderAction | null) => void
}

export function createDatatableMobileDrawerStack<
  TPageId extends string,
  TParamsByPage extends Record<TPageId, unknown>,
>(
  pageId: TPageId,
  params: TParamsByPage[TPageId],
): DatatableMobileDrawerStackEntry<TPageId, TParamsByPage>[] {
  return [createDatatableMobileDrawerStackEntry(pageId, params)]
}

export function getCurrentDatatableMobileDrawerEntry<
  TPageId extends string,
  TParamsByPage extends Record<TPageId, unknown>,
>(stack: readonly DatatableMobileDrawerStackEntry<TPageId, TParamsByPage>[]) {
  const current = stack.at(-1)
  if (!current) {
    throw new Error("Datatable mobile drawer stack cannot be empty.")
  }
  return current
}

export function pushDatatableMobileDrawerStack<
  TPageId extends string,
  TParamsByPage extends Record<TPageId, unknown>,
  TNextPageId extends TPageId,
>(
  stack: readonly DatatableMobileDrawerStackEntry<TPageId, TParamsByPage>[],
  pageId: TNextPageId,
  params: TParamsByPage[TNextPageId],
) {
  return [...stack, createDatatableMobileDrawerStackEntry(pageId, params)]
}

export function replaceDatatableMobileDrawerStack<
  TPageId extends string,
  TParamsByPage extends Record<TPageId, unknown>,
  TNextPageId extends TPageId,
>(
  stack: readonly DatatableMobileDrawerStackEntry<TPageId, TParamsByPage>[],
  pageId: TNextPageId,
  params: TParamsByPage[TNextPageId],
) {
  if (stack.length === 0) return createDatatableMobileDrawerStack(pageId, params)
  return [...stack.slice(0, -1), createDatatableMobileDrawerStackEntry(pageId, params)]
}

export function popDatatableMobileDrawerStack<
  TPageId extends string,
  TParamsByPage extends Record<TPageId, unknown>,
>(stack: readonly DatatableMobileDrawerStackEntry<TPageId, TParamsByPage>[]) {
  if (stack.length <= 1) return [...stack]
  return stack.slice(0, -1)
}

function createDatatableMobileDrawerStackEntry<
  TPageId extends string,
  TParamsByPage extends Record<TPageId, unknown>,
>(
  pageId: TPageId,
  params: TParamsByPage[TPageId],
): DatatableMobileDrawerStackEntry<TPageId, TParamsByPage> {
  return {
    key: `${pageId}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    pageId,
    params,
  }
}

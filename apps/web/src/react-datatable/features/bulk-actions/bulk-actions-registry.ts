import type {
  DatatableBulkAction,
  DatatableBulkActionContext,
  DatatableBulkActionItem,
  DatatableBulkActionStep,
  DatatableBulkServerActionRequest,
} from "../../types/props.types"

interface GetVisibleBulkActionsParams<TData> {
  actions: DatatableBulkAction<TData>[]
  context: DatatableBulkActionContext<TData>
}

export function getVisibleBulkActions<TData>({
  actions,
  context,
}: GetVisibleBulkActionsParams<TData>) {
  return actions.filter((action) => action.isVisible?.(context) ?? true)
}

interface GetVisibleBulkActionItemsParams<TData> {
  items: DatatableBulkActionItem<TData>[]
  context: DatatableBulkActionContext<TData>
}

export function getVisibleBulkActionItems<TData>({
  items,
  context,
}: GetVisibleBulkActionItemsParams<TData>) {
  return items.filter((item) => item.isVisible?.(context) ?? true)
}

interface ResolveBulkActionInitialStepParams<TData> {
  action: DatatableBulkAction<TData>
  context: DatatableBulkActionContext<TData>
}

export async function resolveBulkActionInitialStep<TData>({
  action,
  context,
}: ResolveBulkActionInitialStepParams<TData>): Promise<DatatableBulkActionStep<TData> | null> {
  if (!action.getInitialStep) {
    return null
  }

  return await action.getInitialStep(context)
}

interface BuildBulkActionServerRequestParams<TData> {
  action: DatatableBulkAction<TData>
  context: DatatableBulkActionContext<TData>
}

export function buildBulkActionServerRequest<TData>({
  action,
  context,
}: BuildBulkActionServerRequestParams<TData>): DatatableBulkServerActionRequest | null {
  if (action.execution !== "server" || !action.serverActionId) {
    return null
  }

  return {
    actionId: action.serverActionId,
    selection: context.selection,
    payload: action.buildServerPayload?.(context),
  }
}

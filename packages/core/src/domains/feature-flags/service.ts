import { Effect } from "effect"

import {
  ForbiddenError,
  InternalError,
  InvalidRequestError,
  InvariantViolationError,
  NotFoundError,
} from "../../shared/errors"
import type { AuthenticatedContext } from "../auth/authenticate"

export type FeatureFlagExposure = "client" | "server"
export type FeatureFlagValueType = "boolean"

export type BooleanFeatureFlagDefinition = {
  defaultValue: boolean
  description: string
  exposure: FeatureFlagExposure
  valueType: FeatureFlagValueType
}

export function defineBooleanFlag<
  const TInput extends Omit<BooleanFeatureFlagDefinition, "valueType">,
>(input: TInput) {
  return {
    ...input,
    valueType: "boolean" as const,
  }
}

export const featureFlags = {
  "developer.browserFlagOverrides": defineBooleanFlag({
    defaultValue: false,
    description: "Allows local browser feature flag overrides for testing.",
    exposure: "client",
  }),
} as const

export type FeatureFlagKey = keyof typeof featureFlags
export type ClientFeatureFlagKey = {
  [K in FeatureFlagKey]: (typeof featureFlags)[K]["exposure"] extends "client" ? K : never
}[FeatureFlagKey]

export type FeatureFlagRuleField =
  | "user.id"
  | "user.email"
  | "workspace.id"
  | "workspace.role"
  | "workspace.slug"

export type FeatureFlagRuleOperator = "contains" | "equals" | "notContains" | "notEquals"

export type FeatureFlagRuleCondition = {
  field: FeatureFlagRuleField
  operator: FeatureFlagRuleOperator
  value: string
}

export type FeatureFlagEvaluationContext = {
  user: {
    email: string
    emailNormalized: string
    id: string
  }
  workspace: {
    id: string
    role: string
    slug: string
  }
}

export type FeatureFlagRuleDto = {
  conditions: FeatureFlagRuleCondition[]
  createdAt: Date
  createdById: string | null
  deletedAt: Date | null
  description: string | null
  enabled: boolean
  flagKey: string
  id: string
  priority: number
  updatedAt: Date
  value: boolean
  workspaceId: string | null
  workspaceSlug: string | null
}

export type FeatureFlagRuleCreateInput = {
  conditions: FeatureFlagRuleCondition[]
  description?: string | null
  enabled?: boolean
  flagKey: string
  priority?: number
  value: boolean
}

export type FeatureFlagRuleCreateScope = {
  createdById: string
  workspaceId: string
  workspaceSlug: string
}

export type FeatureFlagRuleUpdateInput = {
  conditions?: FeatureFlagRuleCondition[]
  description?: string | null
  enabled?: boolean
  priority?: number
  ruleId: string
  value?: boolean
}

export type FeatureFlagStore = {
  createRule?: (
    scope: FeatureFlagRuleCreateScope,
    input: Required<Pick<FeatureFlagRuleCreateInput, "conditions" | "enabled" | "priority">> &
      Pick<FeatureFlagRuleCreateInput, "description" | "flagKey" | "value">,
  ) => Promise<FeatureFlagRuleDto>
  deleteRule?: (context: AuthenticatedContext, input: { ruleId: string }) => Promise<boolean>
  listRules?: (context: AuthenticatedContext) => Promise<FeatureFlagRuleDto[]>
  listRulesForEvaluation: (context: FeatureFlagEvaluationContext) => Promise<FeatureFlagRuleDto[]>
  updateRule?: (
    context: AuthenticatedContext,
    input: FeatureFlagRuleUpdateInput,
  ) => Promise<FeatureFlagRuleDto | null>
}

type FeatureFlagError =
  | ForbiddenError
  | InternalError
  | InvalidRequestError
  | InvariantViolationError
  | NotFoundError

export type EvaluatedFeatureFlagSnapshot = {
  evaluatedAt: Date
  values: Record<ClientFeatureFlagKey, boolean>
  version: string
}

export function listFeatureFlagRules(
  store: Pick<FeatureFlagStore, "listRules">,
  context: AuthenticatedContext,
): Effect.Effect<FeatureFlagRuleDto[], FeatureFlagError> {
  return Effect.tryPromise({
    try: async () => {
      ensureWorkspaceAdmin(context)
      return store.listRules?.(context) ?? []
    },
    catch: preserveExpectedError("Failed to list feature flag rules"),
  })
}

export function createFeatureFlagRule(
  store: Pick<FeatureFlagStore, "createRule" | "listRulesForEvaluation">,
  context: AuthenticatedContext,
  input: FeatureFlagRuleCreateInput,
): Effect.Effect<FeatureFlagRuleDto, FeatureFlagError> {
  return Effect.tryPromise({
    try: async () => {
      ensureWorkspaceAdmin(context)
      if (!store.createRule) throw new Error("Feature flag store cannot create rules")

      return store.createRule(
        {
          createdById: context.principalId,
          workspaceId: context.workspaceId,
          workspaceSlug: context.workspaceSlug,
        },
        normalizeCreateRuleInput(input),
      )
    },
    catch: preserveExpectedError("Failed to create feature flag rule"),
  })
}

export function updateFeatureFlagRule(
  store: Pick<FeatureFlagStore, "updateRule">,
  context: AuthenticatedContext,
  input: FeatureFlagRuleUpdateInput,
): Effect.Effect<FeatureFlagRuleDto, FeatureFlagError> {
  return Effect.tryPromise({
    try: async () => {
      ensureWorkspaceAdmin(context)
      if (!store.updateRule) throw new Error("Feature flag store cannot update rules")

      const updated = await store.updateRule(context, normalizeUpdateRuleInput(input))
      if (!updated) {
        throw new NotFoundError({
          code: "not_found",
          details: { ruleId: input.ruleId },
          message: "Feature flag rule not found.",
        })
      }
      return updated
    },
    catch: preserveExpectedError("Failed to update feature flag rule"),
  })
}

export function deleteFeatureFlagRule(
  store: Pick<FeatureFlagStore, "deleteRule">,
  context: AuthenticatedContext,
  input: { ruleId: string },
): Effect.Effect<void, FeatureFlagError> {
  return Effect.tryPromise({
    try: async () => {
      ensureWorkspaceAdmin(context)
      if (!store.deleteRule) throw new Error("Feature flag store cannot delete rules")
      const deleted = await store.deleteRule(context, { ruleId: normalizeRuleId(input.ruleId) })
      if (!deleted) {
        throw new NotFoundError({
          code: "not_found",
          details: { ruleId: input.ruleId },
          message: "Feature flag rule not found.",
        })
      }
    },
    catch: preserveExpectedError("Failed to delete feature flag rule"),
  })
}

export function evaluateFeatureFlagsForContext(
  store: Pick<FeatureFlagStore, "listRulesForEvaluation">,
  context: FeatureFlagEvaluationContext,
): Effect.Effect<EvaluatedFeatureFlagSnapshot, FeatureFlagError> {
  return Effect.tryPromise({
    try: async () =>
      evaluateFeatureFlags({
        context,
        rules: await store.listRulesForEvaluation(context),
      }),
    catch: preserveExpectedError("Failed to evaluate feature flags"),
  })
}

export function evaluateFeatureFlags({
  context,
  evaluatedAt = new Date(),
  rules,
}: {
  context: FeatureFlagEvaluationContext
  evaluatedAt?: Date
  rules: FeatureFlagRuleDto[]
}): EvaluatedFeatureFlagSnapshot {
  const values = defaultClientFeatureFlagValues()
  const resolved = new Set<ClientFeatureFlagKey>()
  const sortedRules = [...rules]
    .filter((rule) => rule.enabled && !rule.deletedAt)
    .sort((left, right) => {
      if (left.priority !== right.priority) return right.priority - left.priority
      if (left.updatedAt.getTime() !== right.updatedAt.getTime()) {
        return right.updatedAt.getTime() - left.updatedAt.getTime()
      }
      return left.id.localeCompare(right.id)
    })

  for (const rule of sortedRules) {
    if (!isClientFeatureFlagKey(rule.flagKey) || resolved.has(rule.flagKey)) {
      continue
    }

    if (!conditionsMatch(context, rule.conditions)) {
      continue
    }

    values[rule.flagKey] = rule.value
    resolved.add(rule.flagKey)
  }

  return {
    evaluatedAt,
    values,
    version: "1",
  }
}

export function defaultClientFeatureFlagValues(): Record<ClientFeatureFlagKey, boolean> {
  const values = {} as Record<ClientFeatureFlagKey, boolean>
  for (const key of Object.keys(featureFlags)) {
    if (isClientFeatureFlagKey(key)) {
      values[key] = featureFlags[key].defaultValue
    }
  }
  return values
}

export function defaultClientFeatureFlagSnapshot(
  evaluatedAt = new Date(),
): EvaluatedFeatureFlagSnapshot {
  return {
    evaluatedAt,
    values: defaultClientFeatureFlagValues(),
    version: "defaults",
  }
}

export function parseFeatureFlagRuleConditions(json: string): FeatureFlagRuleCondition[] | null {
  try {
    const value = JSON.parse(json) as unknown
    if (!Array.isArray(value)) return null
    const conditions = value.map(parseCondition)
    if (conditions.some((condition) => !condition)) return null
    return conditions as FeatureFlagRuleCondition[]
  } catch {
    return null
  }
}

function normalizeCreateRuleInput(input: FeatureFlagRuleCreateInput) {
  if (!isFeatureFlagKey(input.flagKey)) {
    throw new InvariantViolationError({
      code: "invariant_violation",
      details: { flagKey: input.flagKey },
      message: "Feature flag key is not registered.",
    })
  }

  if (!Number.isInteger(input.priority ?? 0)) {
    throw new InvalidRequestError({
      code: "invalid_request",
      details: { priority: input.priority },
      message: "Feature flag rule priority must be an integer.",
    })
  }

  const value = normalizeBooleanRuleValue(input.value)

  return {
    conditions: normalizeConditions(input.conditions),
    description: input.description?.trim() || null,
    enabled: input.enabled ?? true,
    flagKey: input.flagKey,
    priority: normalizePriority(input.priority ?? 0),
    value,
  }
}

function normalizeUpdateRuleInput(input: FeatureFlagRuleUpdateInput): FeatureFlagRuleUpdateInput {
  return {
    ...input,
    ...(input.conditions !== undefined
      ? { conditions: normalizeConditions(input.conditions) }
      : {}),
    ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
    ...(input.priority !== undefined ? { priority: normalizePriority(input.priority) } : {}),
    ...(input.value !== undefined ? { value: normalizeBooleanRuleValue(input.value) } : {}),
    ruleId: normalizeRuleId(input.ruleId),
  }
}

function normalizeRuleId(ruleId: string) {
  const trimmed = ruleId.trim()
  if (!trimmed) {
    throw new InvalidRequestError({
      code: "invalid_request",
      details: {},
      message: "Feature flag rule id is required.",
    })
  }
  return trimmed
}

function normalizePriority(priority: number) {
  if (!Number.isInteger(priority)) {
    throw new InvalidRequestError({
      code: "invalid_request",
      details: { priority },
      message: "Feature flag rule priority must be an integer.",
    })
  }
  return priority
}

function normalizeBooleanRuleValue(value: boolean) {
  if (typeof value !== "boolean") {
    throw new InvalidRequestError({
      code: "invalid_request",
      details: { value },
      message: "Feature flag rule value must be a boolean.",
    })
  }
  return value
}

function normalizeConditions(conditions: FeatureFlagRuleCondition[]) {
  if (!Array.isArray(conditions)) {
    throw new InvalidRequestError({
      code: "invalid_request",
      details: { conditions },
      message: "Feature flag rule conditions must be an array.",
    })
  }

  return conditions.map(normalizeCondition)
}

function normalizeCondition(condition: unknown): FeatureFlagRuleCondition {
  if (
    !isRecord(condition) ||
    !isRuleField(condition.field) ||
    !isRuleOperator(condition.operator)
  ) {
    throw new InvalidRequestError({
      code: "invalid_request",
      details: { condition },
      message: "Feature flag rule condition is invalid.",
    })
  }

  if (typeof condition.value !== "string") {
    throw new InvalidRequestError({
      code: "invalid_request",
      details: { condition },
      message: "Feature flag rule condition value must be a string.",
    })
  }

  return {
    field: condition.field,
    operator: condition.operator,
    value: condition.field === "user.email" ? normalizeEmail(condition.value) : condition.value,
  }
}

function ensureWorkspaceAdmin(context: AuthenticatedContext) {
  if (context.role === "workspace_admin") {
    return
  }

  throw new ForbiddenError({
    code: "forbidden",
    details: { role: context.role, workspaceId: context.workspaceId },
    message: "Workspace admin role is required to manage feature flags.",
  })
}

function preserveExpectedError(message: string) {
  return (cause: unknown) => {
    if (
      cause instanceof ForbiddenError ||
      cause instanceof InternalError ||
      cause instanceof InvalidRequestError ||
      cause instanceof InvariantViolationError ||
      cause instanceof NotFoundError
    ) {
      return cause
    }

    return new InternalError({
      code: "internal_error",
      details: { cause: String(cause) },
      message,
    })
  }
}

function parseCondition(value: unknown): FeatureFlagRuleCondition | null {
  if (!isRecord(value)) return null
  if (!isRuleField(value.field)) return null
  if (!isRuleOperator(value.operator)) return null
  if (typeof value.value !== "string") return null

  return {
    field: value.field,
    operator: value.operator,
    value: value.value,
  }
}

function conditionsMatch(
  context: FeatureFlagEvaluationContext,
  conditions: FeatureFlagRuleCondition[],
) {
  return conditions.every((condition) => conditionMatches(context, condition))
}

function conditionMatches(
  context: FeatureFlagEvaluationContext,
  condition: FeatureFlagRuleCondition,
) {
  const left = fieldValue(context, condition.field)
  const right = condition.field === "user.email" ? normalizeEmail(condition.value) : condition.value

  if (condition.operator === "equals") return left === right
  if (condition.operator === "notEquals") return left !== right
  if (condition.operator === "contains") return left.includes(right)
  return !left.includes(right)
}

function fieldValue(context: FeatureFlagEvaluationContext, field: FeatureFlagRuleField) {
  if (field === "user.id") return context.user.id
  if (field === "user.email")
    return normalizeEmail(context.user.emailNormalized || context.user.email)
  if (field === "workspace.id") return context.workspace.id
  if (field === "workspace.role") return context.workspace.role
  return context.workspace.slug
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function isClientFeatureFlagKey(value: string): value is ClientFeatureFlagKey {
  return isFeatureFlagKey(value) && featureFlags[value].exposure === "client"
}

function isFeatureFlagKey(value: string): value is FeatureFlagKey {
  return Object.hasOwn(featureFlags, value)
}

function isRuleField(value: unknown): value is FeatureFlagRuleField {
  return (
    value === "user.id" ||
    value === "user.email" ||
    value === "workspace.id" ||
    value === "workspace.role" ||
    value === "workspace.slug"
  )
}

function isRuleOperator(value: unknown): value is FeatureFlagRuleOperator {
  return (
    value === "contains" || value === "equals" || value === "notContains" || value === "notEquals"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

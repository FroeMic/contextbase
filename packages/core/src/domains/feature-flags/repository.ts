import { and, desc, eq, isNull, or } from "drizzle-orm"

import type { DbClient } from "../../db/client"
import { featureFlagRules } from "../../db/schema"
import type { FeatureFlagRuleDto, FeatureFlagStore } from "./service"
import { parseFeatureFlagRuleConditions } from "./service"

export function createPostgresFeatureFlagStore(client: DbClient): FeatureFlagStore {
  return {
    createRule: async (scope, input) => {
      const [row] = await client.db
        .insert(featureFlagRules)
        .values({
          conditionsJson: JSON.stringify(input.conditions),
          createdById: scope.createdById,
          description: input.description ?? null,
          enabled: input.enabled,
          flagKey: input.flagKey,
          priority: input.priority,
          valueJson: JSON.stringify(input.value),
          workspaceId: scope.workspaceId,
          workspaceSlug: scope.workspaceSlug,
        })
        .returning()

      const mapped = row ? mapFeatureFlagRuleRow(row) : null
      if (!mapped) throw new Error("Feature flag rule insert failed")
      return mapped
    },
    deleteRule: async (context, input) => {
      const rows = await client.db
        .update(featureFlagRules)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(featureFlagRules.id, input.ruleId),
            eq(featureFlagRules.workspaceId, context.workspaceId),
            isNull(featureFlagRules.deletedAt),
          ),
        )
        .returning({ id: featureFlagRules.id })

      return rows.length > 0
    },
    listRules: async (context) => {
      const rows = await client.db
        .select()
        .from(featureFlagRules)
        .where(
          and(
            isNull(featureFlagRules.deletedAt),
            eq(featureFlagRules.workspaceId, context.workspaceId),
          ),
        )
        .orderBy(
          desc(featureFlagRules.priority),
          desc(featureFlagRules.updatedAt),
          featureFlagRules.id,
        )

      return rows.flatMap((row) => {
        const mapped = mapFeatureFlagRuleRow(row)
        return mapped ? [mapped] : []
      })
    },
    listRulesForEvaluation: async (context) => {
      const rows = await client.db
        .select()
        .from(featureFlagRules)
        .where(
          and(
            eq(featureFlagRules.enabled, true),
            isNull(featureFlagRules.deletedAt),
            or(
              isNull(featureFlagRules.workspaceId),
              eq(featureFlagRules.workspaceId, context.workspace.id),
            ),
          ),
        )
        .orderBy(
          desc(featureFlagRules.priority),
          desc(featureFlagRules.updatedAt),
          featureFlagRules.id,
        )

      return rows.flatMap((row) => {
        const mapped = mapFeatureFlagRuleRow(row)
        return mapped ? [mapped] : []
      })
    },
    updateRule: async (context, input) => {
      const [row] = await client.db
        .update(featureFlagRules)
        .set({
          ...(input.conditions !== undefined
            ? { conditionsJson: JSON.stringify(input.conditions) }
            : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          ...(input.value !== undefined ? { valueJson: JSON.stringify(input.value) } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(featureFlagRules.id, input.ruleId),
            eq(featureFlagRules.workspaceId, context.workspaceId),
            isNull(featureFlagRules.deletedAt),
          ),
        )
        .returning()

      return row ? mapFeatureFlagRuleRow(row) : null
    },
  }
}

function mapFeatureFlagRuleRow(row: {
  conditionsJson: string
  createdAt: Date
  createdById: string | null
  deletedAt: Date | null
  description: string | null
  enabled: boolean
  flagKey: string
  id: string
  priority: number
  updatedAt: Date
  valueJson: string
  workspaceId: string | null
  workspaceSlug: string | null
}): FeatureFlagRuleDto | null {
  const value = parseBooleanJson(row.valueJson)
  const conditions = parseFeatureFlagRuleConditions(row.conditionsJson)
  if (value === null || !conditions) return null

  return {
    conditions,
    createdAt: row.createdAt,
    createdById: row.createdById,
    deletedAt: row.deletedAt,
    description: row.description,
    enabled: row.enabled,
    flagKey: row.flagKey,
    id: row.id,
    priority: row.priority,
    updatedAt: row.updatedAt,
    value,
    workspaceId: row.workspaceId,
    workspaceSlug: row.workspaceSlug,
  }
}

function parseBooleanJson(valueJson: string) {
  try {
    const value = JSON.parse(valueJson) as unknown
    return typeof value === "boolean" ? value : null
  } catch {
    return null
  }
}

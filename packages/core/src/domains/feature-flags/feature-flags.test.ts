import { Effect } from "effect"
import { describe, expect, test } from "vitest"

import type { AuthenticatedContext } from "../auth/authenticate"
import {
  createFeatureFlagRule,
  defaultClientFeatureFlagSnapshot,
  evaluateFeatureFlags,
  type FeatureFlagRuleDto,
  featureFlags,
  listFeatureFlagRules,
  parseFeatureFlagRuleConditions,
} from "./service"

const context = {
  user: {
    email: "Michael@Example.com",
    emailNormalized: "michael@example.com",
    id: "usr_123",
  },
  workspace: {
    id: "wrk_123",
    role: "workspace_admin",
    slug: "core",
  },
}

const authContext: AuthenticatedContext = {
  principalId: "usr_123",
  principalKind: "user",
  role: "workspace_admin",
  scopes: ["contextbase:manage"],
  workspaceId: "wrk_123",
  workspaceSlug: "core",
}

describe("feature flags", () => {
  test("declares only retained client boolean flags", () => {
    expect(featureFlags).toEqual({
      "developer.browserFlagOverrides": {
        defaultValue: false,
        description: "Allows local browser feature flag overrides for testing.",
        exposure: "client",
        valueType: "boolean",
      },
    })
  })

  test("evaluates defaults and creates a default client snapshot", () => {
    expect(evaluateFeatureFlags({ context, rules: [] }).values).toEqual({
      "developer.browserFlagOverrides": false,
    })

    expect(defaultClientFeatureFlagSnapshot(new Date("2026-01-01T00:00:00.000Z"))).toEqual({
      evaluatedAt: new Date("2026-01-01T00:00:00.000Z"),
      values: {
        "developer.browserFlagOverrides": false,
      },
      version: "defaults",
    })
  })

  test("matches normalized email and workspace rule conditions", () => {
    expect(
      evaluateFeatureFlags({
        context,
        rules: [
          rule({
            conditions: [
              { field: "workspace.slug", operator: "equals", value: "core" },
              { field: "user.email", operator: "contains", value: "@example.com" },
            ],
            flagKey: "developer.browserFlagOverrides",
            value: true,
          }),
        ],
      }).values["developer.browserFlagOverrides"],
    ).toBe(true)
  })

  test("parses and rejects invalid rule conditions", () => {
    expect(
      parseFeatureFlagRuleConditions(
        JSON.stringify([{ field: "user.email", operator: "equals", value: "michael@example.com" }]),
      ),
    ).toEqual([{ field: "user.email", operator: "equals", value: "michael@example.com" }])

    expect(parseFeatureFlagRuleConditions("[")).toEqual(null)
    expect(
      parseFeatureFlagRuleConditions(
        JSON.stringify([{ field: "user.email", operator: "startsWith", value: "michael" }]),
      ),
    ).toEqual(null)
  })

  test("creates workspace-scoped rules for workspace admins", async () => {
    const writes: unknown[] = []
    const created = await Effect.runPromise(
      createFeatureFlagRule(
        {
          createRule: async (scope, input) => {
            writes.push({ input, scope })
            return rule({
              conditions: input.conditions,
              createdById: scope.createdById,
              flagKey: input.flagKey,
              priority: input.priority,
              value: input.value,
              workspaceId: scope.workspaceId,
              workspaceSlug: scope.workspaceSlug,
            })
          },
          listRulesForEvaluation: async () => [],
        },
        authContext,
        {
          conditions: [{ field: "user.email", operator: "equals", value: "michael@example.com" }],
          flagKey: "developer.browserFlagOverrides",
          priority: 100,
          value: true,
        },
      ),
    )

    expect(created).toMatchObject({
      flagKey: "developer.browserFlagOverrides",
      value: true,
      workspaceId: "wrk_123",
    })
    expect(writes).toEqual([
      {
        input: expect.objectContaining({
          flagKey: "developer.browserFlagOverrides",
          priority: 100,
          value: true,
        }),
        scope: {
          createdById: "usr_123",
          workspaceId: "wrk_123",
          workspaceSlug: "core",
        },
      },
    ])
  })

  test("requires workspace admin role to list and create raw rules", async () => {
    const viewer = { ...authContext, role: "workspace_member" }

    await expect(
      Effect.runPromise(Effect.either(listFeatureFlagRules({ listRules: async () => [] }, viewer))),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { _tag: "ForbiddenError" },
    })

    await expect(
      Effect.runPromise(
        Effect.either(
          createFeatureFlagRule(
            {
              createRule: async () => {
                throw new Error("should not write")
              },
              listRulesForEvaluation: async () => [],
            },
            viewer,
            {
              conditions: [],
              flagKey: "developer.browserFlagOverrides",
              value: true,
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { _tag: "ForbiddenError" },
    })
  })
})

function rule(input: Partial<FeatureFlagRuleDto> = {}): FeatureFlagRuleDto {
  return {
    conditions: [],
    createdAt: new Date("2026-05-27T08:00:00.000Z"),
    createdById: "usr_123",
    deletedAt: null,
    description: null,
    enabled: true,
    flagKey: "developer.browserFlagOverrides",
    id: "ffr_123",
    priority: 100,
    updatedAt: new Date("2026-05-27T08:00:00.000Z"),
    value: false,
    workspaceId: "wrk_123",
    workspaceSlug: "core",
    ...input,
  }
}

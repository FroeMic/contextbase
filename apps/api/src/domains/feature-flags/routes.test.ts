import { describe, expect, test } from "vitest"

import { createApiApp } from "../../app"

const authContext = {
  principalId: "usr_123",
  principalKind: "user",
  role: "workspace_admin",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
} as const

const now = new Date("2026-05-27T10:00:00.000Z")

describe("feature flag routes", () => {
  test("returns typed feature flag registry metadata", async () => {
    const app = createApiApp({
      authenticateApiToken: async () => authContext,
      featureFlagStore: {
        listRulesForEvaluation: async () => [],
      },
    })

    const response = await app.request("/api/v1/feature-flags", {
      headers: { authorization: "Bearer token" },
      method: "GET",
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        "developer.browserFlagOverrides": {
          defaultValue: false,
          exposure: "client",
          valueType: "boolean",
        },
      },
      ok: true,
    })
  })

  test("creates and lists workspace feature flag rules", async () => {
    const createdRules: unknown[] = []
    const app = createApiApp({
      authenticateApiToken: async () => authContext,
      featureFlagStore: {
        createRule: async (scope, input) => {
          createdRules.push({ input, scope })
          return {
            conditions: input.conditions,
            createdAt: now,
            createdById: scope.createdById,
            deletedAt: null,
            description: input.description ?? null,
            enabled: input.enabled,
            flagKey: input.flagKey,
            id: "ffr_123",
            priority: input.priority,
            updatedAt: now,
            value: input.value,
            workspaceId: scope.workspaceId,
            workspaceSlug: scope.workspaceSlug,
          }
        },
        listRules: async () => [
          {
            conditions: [],
            createdAt: now,
            createdById: "usr_123",
            deletedAt: null,
            description: null,
            enabled: true,
            flagKey: "developer.browserFlagOverrides",
            id: "ffr_123",
            priority: 10,
            updatedAt: now,
            value: true,
            workspaceId: "wrk_123",
            workspaceSlug: "core",
          },
        ],
        listRulesForEvaluation: async () => [],
      },
    })

    const createResponse = await app.request("/api/v1/feature-flags/rules", {
      body: JSON.stringify({
        conditions: [{ field: "user.email", operator: "equals", value: "Michael@Example.com" }],
        description: "Enable dashboard editing",
        flagKey: "developer.browserFlagOverrides",
        priority: 10,
        value: true,
      }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      method: "POST",
    })
    const listResponse = await app.request("/api/v1/feature-flags/rules", {
      headers: { authorization: "Bearer token" },
      method: "GET",
    })

    expect(createResponse.status).toBe(201)
    await expect(createResponse.json()).resolves.toMatchObject({
      data: { flagKey: "developer.browserFlagOverrides", id: "ffr_123", value: true },
      ok: true,
    })
    expect(listResponse.status).toBe(200)
    await expect(listResponse.json()).resolves.toMatchObject({
      data: [{ flagKey: "developer.browserFlagOverrides", id: "ffr_123" }],
      ok: true,
    })
    expect(createdRules).toEqual([
      {
        input: expect.objectContaining({
          conditions: [{ field: "user.email", operator: "equals", value: "michael@example.com" }],
        }),
        scope: {
          createdById: "usr_123",
          workspaceId: "wrk_123",
          workspaceSlug: "core",
        },
      },
    ])
  })

  test("rejects invalid create rule payloads before defaulting or writing", async () => {
    let wrote = false
    const app = createApiApp({
      authenticateApiToken: async () => authContext,
      featureFlagStore: {
        createRule: async () => {
          wrote = true
          throw new Error("should not write")
        },
        listRulesForEvaluation: async () => [],
      },
    })

    const missingValueResponse = await app.request("/api/v1/feature-flags/rules", {
      body: JSON.stringify({
        conditions: [],
        flagKey: "developer.browserFlagOverrides",
      }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      method: "POST",
    })
    const malformedConditionsResponse = await app.request("/api/v1/feature-flags/rules", {
      body: JSON.stringify({
        conditions: "user.email == michael@example.com",
        flagKey: "developer.browserFlagOverrides",
        value: true,
      }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      method: "POST",
    })

    expect(missingValueResponse.status).toBe(400)
    await expect(missingValueResponse.json()).resolves.toMatchObject({
      error: { code: "invalid_request" },
      ok: false,
    })
    expect(malformedConditionsResponse.status).toBe(400)
    await expect(malformedConditionsResponse.json()).resolves.toMatchObject({
      error: { code: "invalid_request" },
      ok: false,
    })
    expect(wrote).toBe(false)
  })

  test("updates and deletes feature flag rules", async () => {
    const calls: unknown[] = []
    const app = createApiApp({
      authenticateApiToken: async () => authContext,
      featureFlagStore: {
        deleteRule: async (context, input) => {
          calls.push({ delete: input, workspaceId: context.workspaceId })
          return true
        },
        listRulesForEvaluation: async () => [],
        updateRule: async (context, input) => {
          calls.push({ update: input, workspaceId: context.workspaceId })
          return {
            conditions: input.conditions ?? [],
            createdAt: now,
            createdById: "usr_123",
            deletedAt: null,
            description: input.description ?? null,
            enabled: input.enabled ?? true,
            flagKey: "developer.browserFlagOverrides",
            id: input.ruleId,
            priority: input.priority ?? 0,
            updatedAt: now,
            value: input.value ?? false,
            workspaceId: context.workspaceId,
            workspaceSlug: context.workspaceSlug,
          }
        },
      },
    })

    const patchResponse = await app.request("/api/v1/feature-flags/rules/ffr_123", {
      body: JSON.stringify({ enabled: false, priority: 20 }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      method: "PATCH",
    })
    const deleteResponse = await app.request("/api/v1/feature-flags/rules/ffr_123", {
      headers: { authorization: "Bearer token" },
      method: "DELETE",
    })

    expect(patchResponse.status).toBe(200)
    expect(deleteResponse.status).toBe(200)
    await expect(deleteResponse.json()).resolves.toEqual({ data: {}, ok: true })
    expect(calls).toEqual([
      { update: { enabled: false, priority: 20, ruleId: "ffr_123" }, workspaceId: "wrk_123" },
      { delete: { ruleId: "ffr_123" }, workspaceId: "wrk_123" },
    ])
  })
})

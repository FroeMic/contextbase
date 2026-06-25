import type { ClientFeatureFlagKey } from "@contextbase/core/domains/feature-flags/service"

export type FeatureFlagSnapshot = {
  evaluatedAt: string
  values: Record<ClientFeatureFlagKey, boolean>
  version: string
}

export function createDefaultFeatureFlagSnapshot(): FeatureFlagSnapshot {
  return {
    evaluatedAt: new Date(0).toISOString(),
    values: {
      "developer.browserFlagOverrides": false,
    },
    version: "default",
  }
}

export function serializeFeatureFlagSnapshot(input: {
  evaluatedAt: Date | string
  values: Record<ClientFeatureFlagKey, boolean>
  version: string
}): FeatureFlagSnapshot {
  return {
    evaluatedAt:
      input.evaluatedAt instanceof Date ? input.evaluatedAt.toISOString() : input.evaluatedAt,
    values: input.values,
    version: input.version,
  }
}

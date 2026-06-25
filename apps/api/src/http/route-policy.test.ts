import { describe, expect, test } from "vitest"

import { requiredScopeForApiRequest } from "./route-policy"

describe("requiredScopeForApiRequest", () => {
  test.each([
    ["GET", "/api/v1/workspaces", "contextbase:read"],
    ["HEAD", "/api/v1/workspaces", "contextbase:read"],
    ["GET", "/api/v1/attachments?ownerType=task&ownerId=tsk_123", "contextbase:read"],
    ["GET", "/api/v1/files/fil_123", "contextbase:read"],
    ["POST", "/api/v1/deep-links/resolve", "contextbase:write"],
    ["POST", "/api/v1/files", "contextbase:write"],
    ["POST", "/api/v1/attachments", "contextbase:write"],
    ["POST", "/api/v1/attachments/upload", "contextbase:write"],
    ["POST", "/api/v1/files/inline-upload", "contextbase:write"],
    ["DELETE", "/api/v1/attachments/fla_123", "contextbase:write"],
    ["GET", "/api/v1/files/fil_123/content", "contextbase:files"],
    ["POST", "/api/v1/workspaces", "contextbase:manage"],
    ["PATCH", "/api/v1/workspaces/core", "contextbase:manage"],
    ["POST", "/api/v1/workspaces/core/rename-slug", "contextbase:manage"],
    ["POST", "/api/v1/workspaces/core/archive", "contextbase:manage"],
    ["POST", "/api/v1/workspaces/core/reactivate", "contextbase:manage"],
    ["POST", "/api/v1/users", "contextbase:manage"],
    ["PATCH", "/api/v1/users/usr_123", "contextbase:manage"],
    ["GET", "/api/v1/workspace-invitations", "contextbase:manage"],
    ["POST", "/api/v1/workspace-invitations", "contextbase:manage"],
    ["POST", "/api/v1/workspace-invitations/win_123/revoke", "contextbase:manage"],
    ["GET", "/api/v1/workspace-members", "contextbase:manage"],
    ["PATCH", "/api/v1/workspace-members/mbr_123", "contextbase:manage"],
    ["POST", "/api/v1/workspace-members/mbr_123/disable", "contextbase:manage"],
    ["POST", "/api/v1/workspace-members/mbr_123/reactivate", "contextbase:manage"],
    ["POST", "/api/v1/feature-flags/rules", "contextbase:manage"],
    ["PATCH", "/api/v1/feature-flags/rules/ffr_123", "contextbase:manage"],
    ["DELETE", "/api/v1/feature-flags/rules/ffr_123", "contextbase:manage"],
  ] as const)("maps %s %s to %s", (method, path, expectedScope) => {
    expect(
      requiredScopeForApiRequest(new Request(`https://api.vertical.test${path}`, { method })),
    ).toBe(expectedScope)
  })
})

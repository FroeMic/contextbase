import { Effect } from "effect"
import { describe, expect, test } from "vitest"

import type { AuthenticatedContext } from "./authenticate"
import { requireWorkspaceAdminAccess } from "./workspace-access"

describe("requireWorkspaceAdminAccess", () => {
  test("allows unscoped workspace admin browser-style contexts", async () => {
    await expect(
      Effect.runPromise(requireWorkspaceAdminAccess(context({ role: "workspace_admin" }))),
    ).resolves.toBeUndefined()
  })

  test("requires contextbase:manage for scoped user bearer contexts", async () => {
    await expect(
      Effect.runPromise(
        Effect.flip(
          requireWorkspaceAdminAccess(
            context({ role: "workspace_admin", scopes: ["contextbase:read", "contextbase:write"] }),
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "ForbiddenError",
      code: "forbidden",
    })

    await expect(
      Effect.runPromise(
        requireWorkspaceAdminAccess(
          context({ role: "workspace_admin", scopes: ["contextbase:read", "contextbase:manage"] }),
        ),
      ),
    ).resolves.toBeUndefined()
  })

  test("does not let member users gain admin access from contextbase:manage", async () => {
    await expect(
      Effect.runPromise(
        Effect.flip(
          requireWorkspaceAdminAccess(
            context({
              role: "workspace_member",
              scopes: ["contextbase:read", "contextbase:manage"],
            }),
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "ForbiddenError",
      code: "forbidden",
    })
  })

  test("allows only explicitly elevated workspace agents", async () => {
    await expect(
      Effect.runPromise(
        Effect.flip(
          requireWorkspaceAdminAccess(
            context({
              principalId: "agt_builder",
              principalKind: "agent",
              role: "workspace_agent",
              scopes: ["contextbase:read"],
            }),
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "ForbiddenError",
      code: "forbidden",
    })

    await expect(
      Effect.runPromise(
        requireWorkspaceAdminAccess(
          context({
            principalId: "agt_builder",
            principalKind: "agent",
            role: "workspace_agent",
            scopes: ["contextbase:read", "contextbase:manage"],
          }),
        ),
      ),
    ).resolves.toBeUndefined()
  })
})

function context(input: Partial<AuthenticatedContext>): AuthenticatedContext {
  return {
    principalId: "usr_admin",
    principalKind: "user",
    role: "workspace_admin",
    workspaceId: "wrk_123",
    workspaceSlug: "core",
    ...input,
  }
}

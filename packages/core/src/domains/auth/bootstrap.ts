import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { eq } from "drizzle-orm"
import { Effect } from "effect"

import type { DbClient } from "../../db/client"
import { apiTokens, users, workspaceMemberships, workspaces } from "../../db/schema"
import { ConflictError } from "../../shared/errors"

export type BootstrapInput = {
  label?: string
  userName: string
  workspaceName: string
  workspaceSlug: string
}

export type BootstrapResult = {
  apiToken: string
  userId: string
  workspaceId: string
  workspaceSlug: string
}

export function createBootstrapToken() {
  return `vct_${randomBytes(32).toString("base64url")}`
}

export function hashApiToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function verifyApiToken(token: string, tokenHash: string) {
  const actual = Buffer.from(hashApiToken(token), "hex")
  const expected = Buffer.from(tokenHash, "hex")

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function bootstrapWorkspaceAdmin(
  client: DbClient,
  input: BootstrapInput,
): Effect.Effect<BootstrapResult, ConflictError> {
  return Effect.tryPromise({
    try: async () => {
      const existing = await client.db.query.workspaces.findFirst({
        where: eq(workspaces.workspaceSlug, input.workspaceSlug),
      })

      if (existing) {
        throw new ConflictError({
          code: "conflict",
          details: {
            workspaceSlug: input.workspaceSlug,
          },
          message: "Workspace already exists",
        })
      }

      const token = createBootstrapToken()
      const tokenHash = hashApiToken(token)

      return client.db.transaction(async (tx) => {
        const [workspace] = await tx
          .insert(workspaces)
          .values({
            workspaceName: input.workspaceName,
            workspaceSlug: input.workspaceSlug,
          })
          .returning({
            id: workspaces.id,
            workspaceSlug: workspaces.workspaceSlug,
          })

        const [user] = await tx
          .insert(users)
          .values({
            displayName: input.userName,
          })
          .returning({
            id: users.id,
          })

        if (!workspace || !user) {
          throw new Error("Bootstrap insert failed")
        }

        await tx.insert(workspaceMemberships).values({
          principalId: user.id,
          principalKind: "user",
          role: "workspace_admin",
          workspaceId: workspace.id,
          workspaceSlug: workspace.workspaceSlug,
        })

        await tx.insert(apiTokens).values({
          label: input.label ?? "workspace-local-cli",
          principalId: user.id,
          principalKind: "user",
          scopeJson: JSON.stringify([
            "contextbase:read",
            "contextbase:write",
            "contextbase:files",
            "contextbase:manage",
          ]),
          tokenHash,
          workspaceId: workspace.id,
          workspaceSlug: workspace.workspaceSlug,
        })

        return {
          apiToken: token,
          userId: user.id,
          workspaceId: workspace.id,
          workspaceSlug: workspace.workspaceSlug,
        }
      })
    },
    catch: (cause) => {
      if (cause instanceof ConflictError) {
        return cause
      }

      return new ConflictError({
        code: "conflict",
        details: {
          cause: String(cause),
        },
        message: "Bootstrap failed",
      })
    },
  })
}

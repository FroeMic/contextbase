import { defineQueries, defineQueryWithType } from "@rocicorp/zero"
import { z } from "zod"

import type { ZeroAuthContext } from "./context"
import { type schema, zql } from "./schema"

const defineAppQuery = defineQueryWithType<typeof schema, ZeroAuthContext>()

const workspaceRowsArgs = z.object({
  limit: z.number().int().min(1).max(500).default(100),
})

const capturedSessionArgs = z.object({
  capturedSessionId: z.string(),
  limit: z.number().int().min(1).max(1000).default(500),
})

function hasActiveWorkspace(ctx: ZeroAuthContext | undefined): ctx is ZeroAuthContext {
  return !!ctx?.activeWorkspaceId
}

export const queries = defineQueries({
  activeWorkspace: defineAppQuery(({ ctx }) => {
    if (!hasActiveWorkspace(ctx)) {
      return zql.workspaces.where(({ or }) => or()).one()
    }

    return zql.workspaces.where("id", ctx.activeWorkspaceId).where("status", "active").one()
  }),
  currentUser: defineAppQuery(({ ctx }) => {
    if (!ctx?.userId) {
      return zql.users.where(({ or }) => or()).one()
    }

    return zql.users.where("id", ctx.userId).where("status", "active").one()
  }),
  publicAvatarFile: defineAppQuery(z.object({ fileId: z.string() }), ({ args }) =>
    zql.fileObjects
      .where("id", args.fileId)
      .where("visibility", "public")
      .where("usageKind", "avatar")
      .where("storageStatus", "available")
      .where("deletedAt", "IS", null)
      .one(),
  ),
  capturedSessionsByWorkspace: defineAppQuery(workspaceRowsArgs, ({ args, ctx }) => {
    if (!hasActiveWorkspace(ctx)) {
      return zql.capturedSessions.where(({ or }) => or())
    }

    return zql.capturedSessions
      .where("workspaceId", ctx.activeWorkspaceId)
      .where("status", "active")
      .orderBy("lastSyncedAt", "desc")
      .limit(args.limit)
  }),
  capturedSessionMessages: defineAppQuery(capturedSessionArgs, ({ args, ctx }) => {
    if (!hasActiveWorkspace(ctx)) {
      return zql.capturedSessionMessages.where(({ or }) => or())
    }

    return zql.capturedSessionMessages
      .where("workspaceId", ctx.activeWorkspaceId)
      .where("capturedSessionId", args.capturedSessionId)
      .orderBy("sequenceNumber", "asc")
      .limit(args.limit)
  }),
  capturedSessionArtifacts: defineAppQuery(capturedSessionArgs, ({ args, ctx }) => {
    if (!hasActiveWorkspace(ctx)) {
      return zql.capturedSessionArtifacts.where(({ or }) => or())
    }

    return zql.capturedSessionArtifacts
      .where("workspaceId", ctx.activeWorkspaceId)
      .where("capturedSessionId", args.capturedSessionId)
      .orderBy("createdAt", "asc")
      .orderBy("id", "asc")
      .limit(args.limit)
  }),
  syncEventsByCapturedSession: defineAppQuery(capturedSessionArgs, ({ args, ctx }) => {
    if (!hasActiveWorkspace(ctx)) {
      return zql.sessionCaptureSyncEvents.where(({ or }) => or())
    }

    return zql.sessionCaptureSyncEvents
      .where("workspaceId", ctx.activeWorkspaceId)
      .where("capturedSessionId", args.capturedSessionId)
      .orderBy("createdAt", "desc")
      .limit(args.limit)
  }),
  usersByWorkspace: defineAppQuery(workspaceRowsArgs, ({ args, ctx }) => {
    if (!hasActiveWorkspace(ctx)) {
      return zql.workspaceMemberships.where(({ or }) => or())
    }

    return zql.workspaceMemberships
      .where("workspaceId", ctx.activeWorkspaceId)
      .where("principalKind", "user")
      .where("status", "active")
      .related("user", (user) => user.related("avatarFileObject"))
      .orderBy("createdAt", "desc")
      .limit(args.limit)
  }),
})

export type Queries = typeof queries

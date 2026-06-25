import { Effect } from "effect"
import { describe, expect, test } from "vitest"
import { ConflictError, NotFoundError } from "../../shared/errors"
import type { AuthenticatedContext } from "../auth/authenticate"
import {
  acceptWorkspaceInvitation,
  createWorkspaceInvitation,
  hashInvitationToken,
  listWorkspaceInvitations,
  revokeWorkspaceInvitation,
} from "./service"

const adminContext: AuthenticatedContext = {
  principalId: "usr_admin",
  principalKind: "user",
  role: "workspace_admin",
  workspaceId: "wrk_123",
  workspaceSlug: "core",
  scopes: ["contextbase:manage"],
}

const memberContext: AuthenticatedContext = {
  ...adminContext,
  principalId: "usr_member",
  role: "workspace_member",
}

describe("workspace invitations service", () => {
  test("requires workspace admin access to create invitations", async () => {
    await expect(
      Effect.runPromise(
        Effect.either(
          createWorkspaceInvitation(
            {
              createInvitation: async () => {
                throw new Error("should not create invitation")
              },
            },
            memberContext,
            {
              email: "new@example.com",
              role: "workspace_member",
            },
            {
              randomToken: () => "raw_invite",
              ttlSeconds: 3600,
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { _tag: "ForbiddenError" },
    })
  })

  test("creates an invitation with a hashed token and delivery payload", async () => {
    const writes: unknown[] = []
    const result = await Effect.runPromise(
      createWorkspaceInvitation(
        {
          createInvitation: async (_context, input) => {
            writes.push(input)
            return { ...input, id: "win_123", status: "pending" }
          },
        },
        adminContext,
        {
          email: " New@Example.com ",
          role: "workspace_member",
        },
        {
          now: new Date("2026-06-06T10:00:00.000Z"),
          randomToken: () => "raw_invite",
          ttlSeconds: 3600,
        },
      ),
    )

    expect(result).toMatchObject({
      delivery: {
        email: "new@example.com",
        rawToken: "raw_invite",
      },
      invitation: {
        email: "new@example.com",
        id: "win_123",
        role: "workspace_member",
      },
    })
    expect(writes).toEqual([
      {
        email: "new@example.com",
        emailNormalized: "new@example.com",
        expiresAt: new Date("2026-06-06T11:00:00.000Z"),
        invitedByUserId: "usr_admin",
        role: "workspace_member",
        tokenHash: hashInvitationToken("raw_invite"),
        workspaceId: "wrk_123",
        workspaceSlug: "core",
      },
    ])
  })

  test("rejects invalid invitation create input before storing it", async () => {
    for (const input of [
      { email: "not-an-email", role: "workspace_member" },
      { email: "new@example.com", role: "owner" },
    ]) {
      await expect(
        Effect.runPromise(
          Effect.either(
            createWorkspaceInvitation(
              {
                createInvitation: async () => {
                  throw new Error("should not store invalid invitation")
                },
              },
              adminContext,
              input as { email: string; role: "workspace_member" },
              {
                randomToken: () => "raw_invite",
                ttlSeconds: 3600,
              },
            ),
          ),
        ),
      ).resolves.toMatchObject({
        _tag: "Left",
        left: {
          _tag: "InvalidRequestError",
          code: "invalid_request",
        },
      })
    }
  })

  test("requires workspace admin access to revoke invitations", async () => {
    await expect(
      Effect.runPromise(
        Effect.either(
          revokeWorkspaceInvitation(
            {
              revokeInvitation: async () => {
                throw new Error("should not revoke invitation")
              },
            },
            memberContext,
            {
              invitationId: "win_123",
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { _tag: "ForbiddenError" },
    })
  })

  test("preserves typed revoke failures for stale or missing invitations", async () => {
    await expect(
      Effect.runPromise(
        Effect.either(
          revokeWorkspaceInvitation(
            {
              revokeInvitation: async () => {
                throw new NotFoundError({
                  code: "not_found",
                  message: "Workspace invitation not found",
                })
              },
            },
            adminContext,
            { invitationId: "win_missing" },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { _tag: "NotFoundError", code: "not_found" },
    })

    await expect(
      Effect.runPromise(
        Effect.either(
          revokeWorkspaceInvitation(
            {
              revokeInvitation: async () => {
                throw new ConflictError({
                  code: "conflict",
                  message: "Workspace invitation is no longer revocable",
                })
              },
            },
            adminContext,
            { invitationId: "win_accepted" },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { _tag: "ConflictError", code: "conflict" },
    })
  })

  test("lists invitations for workspace admins", async () => {
    const result = await Effect.runPromise(
      listWorkspaceInvitations(
        {
          listInvitations: async (context) => [
            {
              acceptedAt: null,
              email: "new@example.com",
              emailNormalized: "new@example.com",
              expiresAt: new Date("2026-06-06T11:00:00.000Z"),
              id: "win_123",
              invitedByUserId: "usr_admin",
              revokedAt: null,
              role: "workspace_member",
              status: "pending",
              tokenHash: "hash",
              workspaceId: context.workspaceId,
              workspaceSlug: context.workspaceSlug,
            },
          ],
        },
        adminContext,
      ),
    )

    expect(result).toMatchObject([{ id: "win_123", email: "new@example.com" }])
  })

  test("requires workspace admin access to list invitations", async () => {
    await expect(
      Effect.runPromise(
        Effect.either(
          listWorkspaceInvitations(
            {
              listInvitations: async () => {
                throw new Error("should not list invitations")
              },
            },
            memberContext,
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { _tag: "ForbiddenError" },
    })
  })

  test("accepts an invitation into a browser session", async () => {
    const result = await Effect.runPromise(
      acceptWorkspaceInvitation(
        {
          acceptInvitationWithSession: async (input) => ({
            session: {
              activeWorkspaceId: "wrk_123",
              activeWorkspaceSlug: "core",
              expiresAt: input.sessionExpiresAt,
              sessionId: "ses_123",
              userId: "usr_123",
            },
            userId: "usr_123",
            workspaceId: "wrk_123",
            workspaceSlug: "core",
          }),
        },
        {
          now: new Date("2026-06-06T10:00:00.000Z"),
          randomToken: () => "raw_session",
          rawToken: "raw_invite",
          sessionTtlSeconds: 3600,
        },
      ),
    )

    expect(result).toMatchObject({
      rawSessionToken: "raw_session",
      session: {
        activeWorkspaceId: "wrk_123",
        sessionId: "ses_123",
      },
    })
  })

  test("preserves typed accept conflicts for existing memberships", async () => {
    await expect(
      Effect.runPromise(
        Effect.either(
          acceptWorkspaceInvitation(
            {
              acceptInvitationWithSession: async () => {
                throw new ConflictError({
                  code: "conflict",
                  message: "User already has a workspace membership",
                })
              },
            },
            {
              randomToken: () => "raw_session",
              rawToken: "raw_invite",
              sessionTtlSeconds: 3600,
            },
          ),
        ),
      ),
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { _tag: "ConflictError", code: "conflict" },
    })
  })
})

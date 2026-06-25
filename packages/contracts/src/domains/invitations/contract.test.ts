import { Schema } from "effect"
import { describe, expect, test } from "vitest"

import { workspaceInvitationCommandMetadata } from "./cli.js"
import {
  WorkspaceInvitationCreateBodySchema,
  WorkspaceInvitationDtoSchema,
  WorkspaceInvitationResponseSchema,
} from "./contract.js"

describe("workspace invitation contracts", () => {
  test("decodes invitation response envelopes", () => {
    const decoded = Schema.decodeUnknownSync(WorkspaceInvitationResponseSchema)({
      data: {
        acceptedAt: null,
        email: "new@example.com",
        emailNormalized: "new@example.com",
        expiresAt: "2026-06-13T10:00:00.000Z",
        id: "win_123",
        invitedByUserId: "usr_admin",
        revokedAt: null,
        role: "workspace_member",
        status: "pending",
        workspaceId: "wrk_123",
        workspaceSlug: "core",
      },
      ok: true,
    })

    expect(decoded.data.id).toBe("win_123")
  })

  test("validates create roles", () => {
    expect(
      Schema.decodeUnknownSync(WorkspaceInvitationCreateBodySchema)({
        email: "new@example.com",
        role: "workspace_admin",
      }),
    ).toEqual({
      email: "new@example.com",
      role: "workspace_admin",
    })

    expect(() =>
      Schema.decodeUnknownSync(WorkspaceInvitationDtoSchema)({
        role: "owner",
      }),
    ).toThrow()
  })

  test("exposes CLI metadata", () => {
    expect(workspaceInvitationCommandMetadata.map((metadata) => metadata.id)).toEqual([
      "invitations.list",
      "invitations.create",
      "invitations.revoke",
    ])
  })
})

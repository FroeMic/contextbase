import type { CliCommandMetadata } from "../../shared/cli.js"

type CliOption = CliCommandMetadata["options"][number]

const jsonOption: CliOption = {
  description: "Output JSON",
  name: "json",
  repeatable: false,
  required: false,
  type: "boolean",
}

const emailOption: CliOption = {
  description: "Invitee email address",
  name: "email",
  repeatable: false,
  required: true,
  type: "string",
}

const roleOption: CliOption = {
  description: "Workspace role",
  name: "role",
  repeatable: false,
  required: false,
  type: "string",
  values: ["workspace_admin", "workspace_member"],
}

const dryJsonOutput = {
  dryRun: true,
  json: true,
} as const

export const workspaceInvitationCommandMetadata: CliCommandMetadata[] = [
  {
    arguments: [],
    description: "List pending and historical workspace invitations.",
    examples: ["contextbase invitations list --json"],
    id: "invitations.list",
    options: [jsonOption],
    output: dryJsonOutput,
    path: ["invitations", "list"],
    summary: "List workspace invitations",
  },
  {
    arguments: [],
    description: "Create and deliver a workspace invitation.",
    examples: [
      "contextbase invitations create --email teammate@example.com --role workspace_member --json",
    ],
    id: "invitations.create",
    options: [emailOption, roleOption, jsonOption],
    output: dryJsonOutput,
    path: ["invitations", "create"],
    summary: "Create workspace invitation",
  },
  {
    arguments: [{ description: "Invitation ID", name: "invitationId", required: true }],
    description: "Revoke a pending workspace invitation.",
    examples: ["contextbase invitations revoke win_123 --json"],
    id: "invitations.revoke",
    options: [jsonOption],
    output: dryJsonOutput,
    path: ["invitations", "revoke"],
    summary: "Revoke workspace invitation",
  },
]

import type { CliCommandMetadata } from "../../shared/cli.js"

type CliOption = CliCommandMetadata["options"][number]

const jsonOption: CliOption = {
  description: "Output JSON",
  name: "json",
  repeatable: false,
  required: false,
  type: "boolean",
}

const dryJsonOutput = {
  dryRun: true,
  json: true,
} as const

export const workspaceMemberCommandMetadata: CliCommandMetadata[] = [
  {
    arguments: [],
    description: "List workspace members.",
    examples: ["contextbase members list --json"],
    id: "members.list",
    options: [jsonOption],
    output: dryJsonOutput,
    path: ["members", "list"],
    summary: "List workspace members",
  },
  {
    arguments: [{ description: "Workspace membership ID", name: "membershipId", required: true }],
    description: "Update a workspace member role.",
    examples: ["contextbase members update mbr_123 --role workspace_admin --json"],
    id: "members.update",
    options: [
      {
        description: "Workspace member role",
        name: "role",
        repeatable: false,
        required: true,
        type: "string",
        values: ["workspace_admin", "workspace_member"],
      },
      jsonOption,
    ],
    output: dryJsonOutput,
    path: ["members", "update"],
    summary: "Update workspace member",
  },
  {
    arguments: [{ description: "Workspace membership ID", name: "membershipId", required: true }],
    description: "Disable a workspace member.",
    examples: ["contextbase members disable mbr_123 --json"],
    id: "members.disable",
    options: [jsonOption],
    output: dryJsonOutput,
    path: ["members", "disable"],
    summary: "Disable workspace member",
  },
  {
    arguments: [{ description: "Workspace membership ID", name: "membershipId", required: true }],
    description: "Reactivate a disabled workspace member.",
    examples: ["contextbase members reactivate mbr_123 --json"],
    id: "members.reactivate",
    options: [jsonOption],
    output: dryJsonOutput,
    path: ["members", "reactivate"],
    summary: "Reactivate workspace member",
  },
]

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

export const workspaceCommandMetadata: CliCommandMetadata[] = [
  {
    arguments: [],
    description: "List workspaces visible to the authenticated token.",
    examples: ["contextbase workspaces list --json"],
    id: "workspaces.list",
    options: [jsonOption],
    output: dryJsonOutput,
    path: ["workspaces", "list"],
    summary: "List workspaces",
  },
  {
    arguments: [],
    description: "Create a workspace.",
    examples: ["contextbase workspaces create --workspace-name Core --workspace-slug core --json"],
    id: "workspaces.create",
    options: [
      {
        description: "Workspace name",
        name: "workspace-name",
        repeatable: false,
        required: true,
        type: "string",
      },
      {
        description: "Workspace slug",
        name: "workspace-slug",
        repeatable: false,
        required: true,
        type: "string",
      },
      jsonOption,
    ],
    output: dryJsonOutput,
    path: ["workspaces", "create"],
    summary: "Create workspace",
  },
  {
    arguments: [{ description: "Workspace ID or slug", name: "workspaceIdOrSlug", required: true }],
    description: "Get a workspace by ID or slug.",
    examples: ["contextbase workspaces get core --json"],
    id: "workspaces.get",
    options: [jsonOption],
    output: dryJsonOutput,
    path: ["workspaces", "get"],
    summary: "Get workspace",
  },
  {
    arguments: [{ description: "Workspace ID or slug", name: "workspaceIdOrSlug", required: true }],
    description: "Update workspace fields.",
    examples: ["contextbase workspaces update core --workspace-name Core --json"],
    id: "workspaces.update",
    options: [
      {
        description: "Workspace name",
        name: "workspace-name",
        repeatable: false,
        required: true,
        type: "string",
      },
      jsonOption,
    ],
    output: dryJsonOutput,
    path: ["workspaces", "update"],
    summary: "Update workspace",
  },
  {
    arguments: [{ description: "Workspace ID or slug", name: "workspaceIdOrSlug", required: true }],
    description: "Archive a workspace.",
    examples: ["contextbase workspaces archive core --json"],
    id: "workspaces.archive",
    options: [jsonOption],
    output: dryJsonOutput,
    path: ["workspaces", "archive"],
    summary: "Archive workspace",
  },
  {
    arguments: [{ description: "Workspace ID or slug", name: "workspaceIdOrSlug", required: true }],
    description: "Rename a workspace slug.",
    examples: ["contextbase workspaces rename-slug core --new-slug new-core --json"],
    id: "workspaces.rename-slug",
    options: [
      {
        description: "New workspace slug",
        name: "new-slug",
        repeatable: false,
        required: true,
        type: "string",
      },
      jsonOption,
    ],
    output: dryJsonOutput,
    path: ["workspaces", "rename-slug"],
    summary: "Rename workspace slug",
  },
  {
    arguments: [{ description: "Workspace ID or slug", name: "workspaceIdOrSlug", required: true }],
    description: "Reactivate an archived workspace.",
    examples: ["contextbase workspaces reactivate core --json"],
    id: "workspaces.reactivate",
    options: [jsonOption],
    output: dryJsonOutput,
    path: ["workspaces", "reactivate"],
    summary: "Reactivate workspace",
  },
]

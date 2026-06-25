import type { CliCommandMetadata } from "../../shared/cli.js"

type CliOption = CliCommandMetadata["options"][number]

const jsonOption: CliOption = {
  description: "Output JSON",
  name: "json",
  repeatable: false,
  required: false,
  type: "boolean",
}

const displayNameOption: CliOption = {
  description: "Display name",
  name: "display-name",
  repeatable: false,
  required: true,
  type: "string",
}

const emailOption: CliOption = {
  description: "Email address",
  name: "email",
  repeatable: false,
  required: false,
  type: "string",
}

const dryJsonOutput = {
  dryRun: true,
  json: true,
} as const

export const userCommandMetadata: CliCommandMetadata[] = [
  {
    arguments: [],
    description: "List users in the authenticated workspace.",
    examples: ["vertical users list --json"],
    id: "users.list",
    options: [jsonOption],
    output: dryJsonOutput,
    path: ["users", "list"],
    summary: "List users",
  },
  {
    arguments: [],
    description: "Create a user.",
    examples: ["vertical users create --display-name Michael --email m@example.com --json"],
    id: "users.create",
    options: [displayNameOption, emailOption, jsonOption],
    output: dryJsonOutput,
    path: ["users", "create"],
    summary: "Create user",
  },
  {
    arguments: [{ description: "User ID", name: "userId", required: true }],
    description: "Get a user by ID.",
    examples: ["vertical users get usr_123 --json"],
    id: "users.get",
    options: [jsonOption],
    output: dryJsonOutput,
    path: ["users", "get"],
    summary: "Get user",
  },
  {
    arguments: [{ description: "User ID", name: "userId", required: true }],
    description: "Update user fields.",
    examples: ["vertical users update usr_123 --display-name Michael --json"],
    id: "users.update",
    options: [displayNameOption, emailOption, jsonOption],
    output: dryJsonOutput,
    path: ["users", "update"],
    summary: "Update user",
  },
]

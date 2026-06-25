import { access, writeFile } from "node:fs/promises"

import { createApiClient } from "@contextbase/api-client"
import { createFileClient } from "@contextbase/api-client/domains/files"

import type { CliCommandMetadata, CliCommandModule } from "../registry.js"

type FileCommandOptions = {
  fetch?: typeof fetch
}

type CliGlobalOptions = {
  apiUrl?: string
  compact?: boolean
  dryRun?: boolean
  json?: boolean
  token?: string
}

const fileCommandMetadata: CliCommandMetadata[] = [
  {
    arguments: [
      { description: "File object ID", name: "fileId", required: true },
      { description: "Output file path", name: "outputPath", required: true },
    ],
    description: "Download file bytes.",
    examples: ["contextbase files download file_123 ./screenshot.png --json"],
    id: "files.download",
    options: [
      {
        description: "Overwrite output file",
        name: "force",
        repeatable: false,
        required: false,
        type: "boolean",
      },
      jsonOption(),
    ],
    output: { dryRun: true, json: true },
    path: ["files", "download"],
    summary: "Download file",
  },
]

export function createFilesCommand(options: FileCommandOptions = {}): CliCommandModule {
  return {
    metadata: requiredMetadata(fileCommandMetadata, 0),
    register: (root, context) => {
      for (const metadata of fileCommandMetadata.slice(1)) context.addCommandMetadata(metadata)

      const files = root.command("files").description("File commands")

      const download = files
        .command("download")
        .description("Download a file")
        .argument("<fileId>")
        .argument("<outputPath>")
      download.option("--force", "Overwrite output file")
      addJsonOption(download)
      download.action(async (fileId: string, outputPath: string) => {
        const force = Boolean((download.opts() as { force?: boolean }).force)
        await runFileDownloadCommand(download, options, { fileId, force, outputPath })
      })
    },
  }
}

function jsonOption(): CliCommandMetadata["options"][number] {
  return {
    description: "Output JSON",
    name: "json",
    repeatable: false,
    required: false,
    type: "boolean",
  }
}

function requiredMetadata(metadata: CliCommandMetadata[], index: number) {
  const item = metadata[index]
  if (!item) throw new Error("Missing file command metadata")
  return item
}

function addJsonOption(command: { option: (flags: string, description?: string) => unknown }) {
  command.option("--json", "Output JSON")
}

async function runFileDownloadCommand(
  command: {
    configureOutput: () => { writeOut?: (message: string) => void }
    optsWithGlobals: () => unknown
  },
  options: FileCommandOptions,
  input: { fileId: string; force: boolean; outputPath: string },
) {
  const globals = command.optsWithGlobals() as CliGlobalOptions
  const request = { method: "GET", path: `/api/v1/files/${input.fileId}/content` }
  if (globals.dryRun) {
    writeJson(command, { data: { ...request, outputPath: input.outputPath }, ok: true }, globals)
    return
  }

  if (!input.force) {
    try {
      await access(input.outputPath)
      throw new Error(`Refusing to overwrite ${input.outputPath}; pass --force`)
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
    }
  }

  const response = await createConfiguredFileClient(globals, options).download(input.fileId)
  await writeFile(input.outputPath, Buffer.from(await response.arrayBuffer()))
  writeJson(
    command,
    { data: { fileId: input.fileId, outputPath: input.outputPath }, ok: true },
    globals,
  )
}

function createConfiguredFileClient(globals: CliGlobalOptions, options: FileCommandOptions) {
  const token = globals.token ?? process.env.CONTEXTBASE_API_TOKEN
  return createFileClient(
    createApiClient({
      baseUrl: globals.apiUrl ?? process.env.CONTEXTBASE_API_URL ?? "http://127.0.0.1:3017",
      ...(options.fetch ? { fetch: options.fetch } : {}),
      ...(token ? { token } : {}),
    }),
  )
}

function writeJson(
  command: { configureOutput: () => { writeOut?: (message: string) => void } },
  value: unknown,
  options: CliGlobalOptions,
) {
  const indent = options.compact ? 0 : 2
  command.configureOutput().writeOut?.(`${JSON.stringify(value, null, indent)}\n`)
}

#!/usr/bin/env node

import { createPublicCliCommand } from "./public-cli.js"
import { runCliMain } from "./runner.js"

async function main() {
  await createPublicCliCommand().parseAsync(process.argv)
}

await runCliMain(main)

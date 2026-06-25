import { cp, mkdir, rm, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "vite"

import { createManifest } from "../src/manifest.ts"

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const distRoot = resolve(appRoot, "dist")

await rm(distRoot, { force: true, recursive: true })
await mkdir(distRoot, { recursive: true })
await cp(resolve(appRoot, "static"), distRoot, { recursive: true })

await buildEntry({
  entry: "src/background/service-worker.ts",
  fileName: "background/service-worker.js",
  format: "es",
})
await buildEntry({
  entry: "src/content-scripts/chatgpt.ts",
  fileName: "content-scripts/chatgpt.js",
  format: "iife",
  name: "ContextbaseChatGptContent",
})
await buildEntry({
  entry: "src/popup/main.ts",
  fileName: "popup/popup.js",
  format: "iife",
  name: "ContextbasePopup",
})

await writeFile(
  resolve(distRoot, "manifest.json"),
  `${JSON.stringify(createManifest(), null, 2)}\n`,
  "utf8",
)

async function buildEntry({ entry, fileName, format, name }) {
  await build({
    build: {
      emptyOutDir: false,
      lib: {
        entry: resolve(appRoot, entry),
        fileName: () => fileName,
        formats: [format],
        name,
      },
      outDir: distRoot,
      rollupOptions: {
        output: {
          extend: true,
        },
      },
    },
    configFile: false,
    root: appRoot,
  })
}

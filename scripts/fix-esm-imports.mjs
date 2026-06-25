#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"

const [, , targetDir] = process.argv

if (!targetDir) {
  console.error("Usage: node scripts/fix-esm-imports.mjs <dir>")
  process.exit(2)
}

const root = path.resolve(targetDir)

if (!fs.existsSync(root)) {
  console.error(`Target directory not found: ${root}`)
  process.exit(1)
}

const exts = new Set([".js", ".mjs", ".cjs", ".json", ".node"])
const textExts = new Set([".js", ".d.ts"])

walk(root)

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath)
      continue
    }

    for (const textExt of textExts) {
      if (fullPath.endsWith(textExt)) {
        rewriteFile(fullPath)
        break
      }
    }
  }
}

function rewriteFile(file) {
  const input = fs.readFileSync(file, "utf8")
  const output = input
    .replace(/(from\s+["'])(\.{1,2}\/[^"']+)(["'])/g, rewriteSpecifier)
    .replace(/(import\s*\(\s*["'])(\.{1,2}\/[^"']+)(["']\s*\))/g, rewriteSpecifier)

  if (output !== input) {
    fs.writeFileSync(file, output)
  }
}

function rewriteSpecifier(_match, prefix, specifier, suffix) {
  if (hasKnownExtension(specifier)) {
    return `${prefix}${specifier}${suffix}`
  }

  return `${prefix}${specifier}.js${suffix}`
}

function hasKnownExtension(specifier) {
  const ext = path.extname(specifier)
  return exts.has(ext)
}

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

const root = process.cwd()

function source(path: string) {
  return readFileSync(join(root, path), "utf8")
}

describe("file storage bundle boundaries", () => {
  test("keeps the base storage module free of AWS SDK imports", () => {
    const storageSource = source("src/domains/files/storage.ts")

    expect(storageSource).not.toContain("@aws-sdk/client-s3")
    expect(storageSource).not.toContain("S3Client")
  })
})

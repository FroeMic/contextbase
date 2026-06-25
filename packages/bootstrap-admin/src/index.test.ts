import { describe, expect, it } from "vitest"

import { ensureRepoRootExecution, parseBootstrapArgs } from "./index.js"

describe("parseBootstrapArgs", () => {
  it("parses explicit values", () => {
    expect(
      parseBootstrapArgs([
        "--json",
        "--workspace-slug",
        "fwf-core",
        "--workspace-name",
        "Found With Friends",
        "--user-name",
        "Michael",
      ]),
    ).toMatchObject({
      json: true,
      userName: "Michael",
      workspaceName: "Found With Friends",
      workspaceSlug: "fwf-core",
    })
  })
})

describe("ensureRepoRootExecution", () => {
  it("throws outside the repo root", () => {
    expect(() => ensureRepoRootExecution("/tmp")).toThrow(/repository root/)
  })
})

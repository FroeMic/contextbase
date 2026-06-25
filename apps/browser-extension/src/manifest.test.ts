import { describe, expect, test } from "vitest"

import { createManifest } from "./manifest"

describe("extension manifest", () => {
  test("declares MV3 entrypoints and limited host permissions", () => {
    const manifest = createManifest()

    expect(manifest.manifest_version).toBe(3)
    expect(manifest.action.default_popup).toBe("popup/index.html")
    expect(manifest.background).toEqual({
      service_worker: "background/service-worker.js",
      type: "module",
    })
    expect(manifest.content_scripts).toEqual([
      {
        js: ["content-scripts/chatgpt.js"],
        matches: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
      },
    ])
    expect(manifest.permissions).toEqual(["activeTab", "storage"])
    expect(manifest.host_permissions).toEqual([
      "https://chatgpt.com/*",
      "https://chat.openai.com/*",
      "http://127.0.0.1/*",
      "http://localhost/*",
      "https://api.contextbase-1.test/*",
      "https://api.contextbase-2.test/*",
    ])
    expect(JSON.stringify(manifest)).not.toContain("<all_urls>")
  })
})

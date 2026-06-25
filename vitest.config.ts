import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // Root runner is for Convex function tests only. Scope the include so the
    // `vitest run convex` name filter can't also match web tests whose paths
    // contain "convex" (e.g. apps/web/.../convex-upload-url.test.ts), which need
    // the web vite aliases this config doesn't provide.
    include: ["convex/**/*.test.ts"],
    environmentMatchGlobs: [["convex/**/*.test.ts", "edge-runtime"]],
  },
})

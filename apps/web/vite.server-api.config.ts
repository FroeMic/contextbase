import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: "dist/server-api",
    rollupOptions: {
      external: (id) =>
        id === "@contextbase/core" ||
        id.startsWith("@contextbase/core/") ||
        id === "sharp" ||
        id.startsWith("@img/sharp"),
      output: {
        chunkFileNames: "chunks/[name]-[hash].js",
        entryFileNames: "server-api.js",
      },
    },
    ssr: "src/server-api-entry.ts",
    target: "node22",
  },
  plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] })],
  ssr: {
    external: ["@contextbase/core"],
    noExternal: ["@contextbase/zero-schema"],
  },
})

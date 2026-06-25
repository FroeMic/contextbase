import { defineConfig } from "wxt"

export default defineConfig({
  browser: "chrome",
  manifest: {
    action: {
      default_popup: "popup.html",
      default_title: "Contextbase",
    },
    host_permissions: [
      "https://chatgpt.com/*",
      "https://chat.openai.com/*",
      "http://127.0.0.1/*",
      "http://localhost/*",
      "https://api.contextbase.localhost/*",
      "https://api.contextbase-1.test/*",
      "https://api.contextbase-2.test/*",
    ],
    name: "Contextbase",
    permissions: ["activeTab", "storage"],
    version: "0.1.0",
  },
  manifestVersion: 3,
  modules: ["@wxt-dev/module-react"],
  outDir: "dist",
  outDirTemplate: ".",
})

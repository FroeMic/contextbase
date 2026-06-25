export type ExtensionManifest = chrome.runtime.ManifestV3

export function createManifest(): ExtensionManifest {
  return {
    action: {
      default_popup: "popup/index.html",
      default_title: "Contextbase Capture",
    },
    background: {
      service_worker: "background/service-worker.js",
      type: "module",
    },
    content_scripts: [
      {
        js: ["content-scripts/chatgpt.js"],
        matches: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
      },
    ],
    description: "Capture visible AI sessions into a local Contextbase workspace.",
    host_permissions: [
      "https://chatgpt.com/*",
      "https://chat.openai.com/*",
      "http://127.0.0.1/*",
      "http://localhost/*",
      "https://api.contextbase-1.test/*",
      "https://api.contextbase-2.test/*",
    ],
    manifest_version: 3,
    name: "Contextbase Capture",
    permissions: ["activeTab", "storage"],
    version: "0.1.0",
  }
}

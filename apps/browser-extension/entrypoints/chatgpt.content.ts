import { defineContentScript } from "wxt/utils/define-content-script"

export default defineContentScript({
  matches: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
  main() {
    void import("../src/content-scripts/chatgpt")
  },
})

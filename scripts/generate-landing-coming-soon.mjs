// One-off: generate photographic editorial images for the landing page's
// coming-soon cards with gpt-image-2 (same model as the product pipeline).
// Usage: node scripts/generate-landing-coming-soon.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const envFile = readFileSync(resolve(root, ".env.local"), "utf8")
const apiKey = envFile.match(/^OPENAI_API_KEY=(.+)$/m)?.[1]?.trim()
if (!apiKey) throw new Error("OPENAI_API_KEY not found in .env.local")

const BASE_STYLE =
  "Editorial photograph, cinematic realism, film stock grain, natural daylight, warm modern workspace, shallow depth of field. No text overlays, no logos, no UI screenshots dominating the frame, no poster composition."

const images = [
  {
    file: "explain-product-updates.png",
    prompt: `Over-the-shoulder photo of a founder at a clean desk reviewing a freshly designed product-launch visual on a laptop, a printed changelog and coffee beside it, soft window light. ${BASE_STYLE}`,
  },
  {
    file: "illustrate-websites-docs.png",
    prompt: `A designer's workspace with a large monitor showing a clean documentation website with a beautiful illustrated header, printed wireframes and illustration sketches scattered on the desk, hands sketching in a notebook in the foreground. ${BASE_STYLE}`,
  },
]

async function generate(image) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt: image.prompt,
      size: "1536x1024",
    }),
  })
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`)
  const payload = await response.json()
  const b64 = payload.data?.[0]?.b64_json
  if (!b64) throw new Error("no image data")
  return Buffer.from(b64, "base64")
}

for (const image of images) {
  const target = resolve(root, "apps/web/public/assets/coming-soon", image.file)
  if (existsSync(target)) {
    console.log(`skip ${image.file} (exists)`)
    continue
  }
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    process.stdout.write(`generating ${image.file} (attempt ${attempt})... `)
    const startedAt = Date.now()
    try {
      writeFileSync(target, await generate(image))
      console.log(`done in ${Math.round((Date.now() - startedAt) / 1000)}s`)
      break
    } catch (error) {
      console.log(`failed: ${error.message}`)
      if (attempt === 3) throw error
      await new Promise((resolveSleep) => setTimeout(resolveSleep, 5000))
    }
  }
}
console.log("ALL DONE")

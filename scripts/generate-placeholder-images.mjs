// One-off: generate placeholder images for coming-soon cards (landing +
// /create) with gpt-image-2. Skips files that already exist.
// Usage: node scripts/generate-placeholder-images.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const envFile = readFileSync(resolve(root, ".env.local"), "utf8")
const apiKey = envFile.match(/^OPENAI_API_KEY=(.+)$/m)?.[1]?.trim()
if (!apiKey) throw new Error("OPENAI_API_KEY not found in .env.local")

// Clean product-mockup aesthetic matching the provided workflow illustrations:
// light neutral background with a subtle dot grid, white rounded cards, soft
// shadows, one accent color, generic non-legible microcopy.
const MOCKUP_STYLE =
  "Clean modern SaaS product illustration, light gray background with a subtle dot grid, white rounded cards with soft shadows, minimal flat UI, one green accent color, generic placeholder text only, no brand names, high resolution, crisp vector-like rendering."

const images = [
  {
    file: "explain-product-updates.png",
    prompt: `A minimal product-update announcement mockup: a single white card with a version tag chip, a short changelog list with two green checkmarks, and a small 'ready to post' badge floating beside it. ${MOCKUP_STYLE}`,
    size: "1536x1024",
  },
  {
    file: "app-mockups.png",
    prompt: `A minimal issue-tracker app interface mockup in the spirit of Linear: one clean window with a narrow sidebar and a simple list of five issue rows with status dots and tiny labels, generous whitespace, nothing else. Restrained, monochrome with one accent color. ${MOCKUP_STYLE}`,
    size: "1536x1024",
  },
  {
    file: "team-headshots.png",
    prompt:
      "A two-by-two grid of four professional team headshots of different people, identical neutral studio background and consistent soft lighting across all four, business-casual clothing, editorial photography, film still quality. No text.",
    size: "1536x1024",
  },
  {
    file: "lifestyle-photos.png",
    prompt:
      "Editorial lifestyle photograph of a founder walking through a sunlit city street with a coffee in hand, candid, cinematic realism, film stock grain, natural daylight, shallow depth of field. No text.",
    size: "1536x1024",
  },
]

async function generate(image) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-2", prompt: image.prompt, size: image.size }),
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

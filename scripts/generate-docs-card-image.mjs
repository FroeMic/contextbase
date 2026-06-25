// One-off: landing card image for "Illustrate websites and docs".
// Light-mode datatable screenshot over a pastel background, referenced from
// the real react-datatable screenshot. Usage: node scripts/generate-docs-card-image.mjs
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const envFile = readFileSync(resolve(root, ".env.local"), "utf8")
const apiKey = envFile.match(/^OPENAI_API_KEY=(.+)$/m)?.[1]?.trim()
if (!apiKey) throw new Error("OPENAI_API_KEY not found in .env.local")

const reference = readFileSync(
  resolve(root, "apps/web/public/assets/coming-soon/docs-images-sample.png"),
)

const prompt = [
  "Recreate the data table application window from the reference as a LIGHT MODE UI:",
  "white table background, dark text, the same layout (search bar, filter chips,",
  "columns Company / Status / Revenue / Responsible / Tags, status dots, colored tag chips).",
  "Place this single app window as a crisp flat screenshot over a soft pastel solid",
  "background (pale mint or pale peach). Composition: generous pastel margin at the top",
  "and the left of the window; the window extends past the bottom and right edges of the",
  "frame so it is cropped off-image. Subtle soft drop shadow, rounded window corners.",
  "No other elements, no text outside the window, no people.",
].join(" ")

const form = new FormData()
form.append("model", "gpt-image-2")
form.append("prompt", prompt)
form.append("size", "1536x1024")
form.append("image", new Blob([reference], { type: "image/png" }), "reference.png")

for (let attempt = 1; attempt <= 3; attempt += 1) {
  process.stdout.write(`generating docs card image (attempt ${attempt})... `)
  const startedAt = Date.now()
  try {
    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`)
    const payload = await response.json()
    const b64 = payload.data?.[0]?.b64_json
    if (!b64) throw new Error("no image data")
    writeFileSync(
      resolve(root, "apps/web/public/assets/coming-soon/illustrate-websites-docs.png"),
      Buffer.from(b64, "base64"),
    )
    console.log(`done in ${Math.round((Date.now() - startedAt) / 1000)}s`)
    break
  } catch (error) {
    console.log(`failed: ${error.message}`)
    if (attempt === 3) throw error
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 5000))
  }
}
console.log("ALL DONE")

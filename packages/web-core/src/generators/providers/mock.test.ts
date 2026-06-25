import { describe, expect, test } from "vitest"

import { TARGET_IMAGE_COUNT } from "./contract"
import { createMockImageProvider, createMockTextPromptProvider } from "./mock"

const sourceBrief = {
  generatorSlug: "cinematic-portraits" as const,
  person: { name: "Ada", role: "Founder", background: "ML", targetAudience: "Investors" },
  contentTheme: "Series A momentum",
  stylePreset: {
    id: "focus-mode",
    label: "Focus mode",
    description: "Quiet solo work",
    visualDirection: "solo work concentration",
  },
  referenceAssetIds: ["a1"],
  promptSeed: "Person: Ada",
}

describe("mock text prompt provider", () => {
  test("produces exactly 10 distinct prompts deterministically", async () => {
    const provider = createMockTextPromptProvider()
    const first = await provider.generatePrompts({ sourceBrief, references: [] })
    const second = await provider.generatePrompts({ sourceBrief, references: [] })

    expect(first).toHaveLength(TARGET_IMAGE_COUNT)
    expect(new Set(first.map((p) => p.title)).size).toBe(TARGET_IMAGE_COUNT)
    expect(first).toEqual(second) // deterministic
    expect(provider.id).toBe("mock")
  })
})

describe("mock image provider", () => {
  test("returns real PNG bytes, never an SVG data URI", async () => {
    const provider = createMockImageProvider()
    const image = await provider.generateImage({
      prompt: "a composed prompt string",
      references: [],
      size: "1024x1536",
    })

    expect(image.mimeType).toBe("image/png")
    expect(image.bytes.byteLength).toBeGreaterThan(0)
    // PNG magic number 0x89 0x50 0x4E 0x47
    expect(Array.from(image.bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })
})

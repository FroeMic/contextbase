import { describe, expect, test } from "vitest"

import {
  assertValidCinematicPromptSet,
  CINEMATIC_BASE_STYLE,
  CINEMATIC_NEGATIVES,
  composeImagePrompt,
  TARGET_IMAGE_COUNT,
  validateCinematicPromptSet,
} from "./contract"
import { createMockTextPromptProvider } from "./mock"
import type { CinematicPrompt } from "./types"

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
  promptSeed: "Person: Ada\nRole: Founder",
}

describe("composeImagePrompt", () => {
  test("appends base style and every negative add-on", () => {
    const prompt: CinematicPrompt = {
      title: "T",
      cameraConcept: "35mm eye-level",
      prompt: "A natural photograph of the subject in an office.",
    }
    const composed = composeImagePrompt(prompt)
    expect(composed).toContain(CINEMATIC_BASE_STYLE)
    expect(composed).toContain("35mm eye-level")
    for (const negative of CINEMATIC_NEGATIVES) {
      expect(composed).toContain(negative)
    }
  })
})

describe("validateCinematicPromptSet", () => {
  test("the mock provider's output passes the contract", async () => {
    const prompts = await createMockTextPromptProvider().generatePrompts({
      sourceBrief,
      references: [],
    })
    expect(prompts).toHaveLength(TARGET_IMAGE_COUNT)
    expect(validateCinematicPromptSet(prompts)).toEqual([])
    expect(() => assertValidCinematicPromptSet(prompts)).not.toThrow()
  })

  test("flags wrong count", () => {
    const violations = validateCinematicPromptSet([])
    expect(violations.some((violation) => violation.code === "count")).toBe(true)
  })

  test("flags short paragraphs and missing fields", () => {
    const prompts: CinematicPrompt[] = Array.from({ length: TARGET_IMAGE_COUNT }, (_, i) => ({
      title: i === 0 ? "" : `Title ${i}`,
      cameraConcept: "35mm",
      prompt: "too short",
    }))
    const codes = new Set(validateCinematicPromptSet(prompts).map((v) => v.code))
    expect(codes.has("title")).toBe(true)
    expect(codes.has("length")).toBe(true)
  })

  test("flags duplicate titles and paragraphs as not distinct", () => {
    const dup: CinematicPrompt = {
      title: "Same",
      cameraConcept: "35mm eye-level wide environmental framing of the subject",
      prompt: "x".repeat(250),
    }
    const prompts = Array.from({ length: TARGET_IMAGE_COUNT }, () => ({ ...dup }))
    const codes = new Set(validateCinematicPromptSet(prompts).map((v) => v.code))
    expect(codes.has("distinct-titles")).toBe(true)
    expect(codes.has("distinct-prompts")).toBe(true)
  })

  test("assert throws a combined message on violation", () => {
    expect(() => assertValidCinematicPromptSet([])).toThrow(/cinematic contract/)
  })
})

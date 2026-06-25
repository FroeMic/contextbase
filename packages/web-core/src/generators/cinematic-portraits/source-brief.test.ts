import { describe, expect, test } from "vitest"

import {
  buildCinematicPortraitsSourceBrief,
  CINEMATIC_PORTRAIT_STYLE_PRESETS,
} from "./source-brief"

describe("buildCinematicPortraitsSourceBrief", () => {
  test("normalizes a complete source brief with one selected style preset and reference assets", () => {
    const brief = buildCinematicPortraitsSourceBrief({
      person: {
        name: "Ruth Bosse",
        role: "CEO at Ruth Bosse GmbH",
        background: "Founder posting about operational leadership and fundraising.",
        targetAudience: "European startup founders and operators",
      },
      contentTheme: "Lessons from building a founder-led sales motion",
      stylePresetId: "collaborative-work",
      referenceAssetIds: ["asset_ref_1", "asset_ref_2"],
    })

    expect(brief.generatorSlug).toBe("cinematic-portraits")
    expect(brief.person.name).toBe("Ruth Bosse")
    expect(brief.stylePreset.id).toBe("collaborative-work")
    expect(brief.referenceAssetIds).toEqual(["asset_ref_1", "asset_ref_2"])
    expect(brief.promptSeed).toContain("European startup founders")
    expect(brief.promptSeed).toContain("Bright, optimistic cinematic lighting")
    expect(brief.promptSeed).toContain("Avoid dark, underexposed, moody")
  })

  test("rejects unknown style presets", () => {
    expect(() =>
      buildCinematicPortraitsSourceBrief({
        person: {
          name: "Michael",
          role: "Founder",
          background: "Builds product tools.",
          targetAudience: "Startup founders",
        },
        contentTheme: "Launch notes",
        stylePresetId: "unknown-style",
        referenceAssetIds: ["asset_ref_1"],
      }),
    ).toThrow("Unknown cinematic portrait style preset")
  })

  test("requires between one and three reference assets", () => {
    const validPreset = CINEMATIC_PORTRAIT_STYLE_PRESETS[0]

    expect(() =>
      buildCinematicPortraitsSourceBrief({
        person: {
          name: "Michael",
          role: "Founder",
          background: "Builds product tools.",
          targetAudience: "Startup founders",
        },
        contentTheme: "Launch notes",
        stylePresetId: validPreset.id,
        referenceAssetIds: [],
      }),
    ).toThrow("Cinematic Portraits jobs require 1-3 reference images")
  })
})

import { z } from "zod"

export const CINEMATIC_PORTRAIT_GENERATOR_SLUG = "cinematic-portraits" as const

export type CinematicPortraitStylePreset = {
  id: string
  label: string
  description: string
  visualDirection: string
}

export const CINEMATIC_PORTRAIT_STYLE_PRESETS = [
  {
    id: "collaborative-work",
    label: "Collaborative work",
    description: "Founder moments in cafes, speaking settings, or active team collaboration.",
    visualDirection:
      "layered social work setting, cafe or conference context, whiteboard collaboration, active founder conversation",
  },
  {
    id: "focus-mode",
    label: "Focus mode",
    description: "Quiet solo work scenes at a desk, on a train, or inside a focused workspace.",
    visualDirection:
      "solo work concentration, laptop and notes, practical screen glow, transit or after-hours office atmosphere",
  },
  {
    id: "in-motion",
    label: "In motion",
    description: "Outdoor founder scenes with movement, scale, and momentum.",
    visualDirection:
      "city or open-environment movement, walking or transit, environmental scale, reflections and motion blur",
  },
] as const satisfies readonly CinematicPortraitStylePreset[]

const sourceBriefInputSchema = z.object({
  person: z.object({
    name: z.string().trim().min(1, "Name is required"),
    role: z.string().trim().min(1, "Role is required"),
    background: z.string().trim().min(1, "Background is required"),
    targetAudience: z.string().trim().min(1, "Target audience is required"),
  }),
  contentTheme: z.string().trim().min(1, "Content theme is required"),
  stylePresetId: z.string().trim().min(1, "Style preset is required"),
  referenceAssetIds: z
    .array(z.string().trim().min(1))
    .min(1, "Cinematic Portraits jobs require 1-3 reference images")
    .max(3, "Cinematic Portraits jobs require 1-3 reference images"),
})

export type CinematicPortraitsSourceBriefInput = z.input<typeof sourceBriefInputSchema>

export type CinematicPortraitsSourceBrief = {
  generatorSlug: typeof CINEMATIC_PORTRAIT_GENERATOR_SLUG
  person: {
    name: string
    role: string
    background: string
    targetAudience: string
  }
  contentTheme: string
  stylePreset: CinematicPortraitStylePreset
  referenceAssetIds: string[]
  promptSeed: string
}

export function buildCinematicPortraitsSourceBrief(
  input: CinematicPortraitsSourceBriefInput,
): CinematicPortraitsSourceBrief {
  const parsed = sourceBriefInputSchema.parse(input)
  const stylePreset = CINEMATIC_PORTRAIT_STYLE_PRESETS.find(
    (preset) => preset.id === parsed.stylePresetId,
  )

  if (!stylePreset) {
    throw new Error(`Unknown cinematic portrait style preset: ${parsed.stylePresetId}`)
  }

  const promptSeed = [
    `Person: ${parsed.person.name}`,
    `Role: ${parsed.person.role}`,
    `Background: ${parsed.person.background}`,
    `Target audience: ${parsed.person.targetAudience}`,
    `Content theme: ${parsed.contentTheme}`,
    `Style preset: ${stylePreset.label}`,
    `Visual direction: ${stylePreset.visualDirection}`,
    "Lighting direction: Bright, optimistic cinematic lighting with open daylight, clear readable faces, natural highlights, and an airy modern feel. Avoid dark, underexposed, moody, low-key, or shadow-dominant images unless the user explicitly asks for them.",
  ].join("\n")

  return {
    generatorSlug: CINEMATIC_PORTRAIT_GENERATOR_SLUG,
    person: parsed.person,
    contentTheme: parsed.contentTheme,
    stylePreset,
    referenceAssetIds: parsed.referenceAssetIds,
    promptSeed,
  }
}

import type { CinematicPrompt } from "./types"

/** Number of images produced per Cinematic Portraits run. */
export const TARGET_IMAGE_COUNT = 10

/** Minimum length of the creative paragraph, so prompts carry real direction. */
export const MIN_PROMPT_LENGTH = 200

/** Base visual style appended to every prompt before it reaches the image model. */
export const CINEMATIC_BASE_STYLE = "cinematic realism, film stock grain, film still"

/** Negative add-ons appended to every prompt (design doc Prompt Generation Contract). */
export const CINEMATIC_NEGATIVES = [
  "no clean digital sharpness",
  "no CGI look",
  "no poster composition",
  "no centered portrait",
  "no black bars",
] as const

export type ContractViolation = {
  code: string
  message: string
}

/**
 * Compose the final prompt string sent to the image model: the director's
 * creative paragraph, then the shared base style, then the negative add-ons.
 * Guarantees the contract's style + negatives by construction rather than by
 * fragile substring validation of LLM output.
 */
export function composeImagePrompt(prompt: CinematicPrompt): string {
  return [
    prompt.prompt.trim(),
    `Composition: ${prompt.cameraConcept.trim()}.`,
    `Base style: ${CINEMATIC_BASE_STYLE}.`,
    `Avoid: ${CINEMATIC_NEGATIVES.join(", ")}.`,
  ].join("\n")
}

/**
 * Structurally validate a prompt set against the Prompt Generation Contract.
 * Objective rules only: exact count, required non-empty fields, minimum
 * paragraph length, and distinctness (unique titles and unique paragraphs).
 * Style/negatives are guaranteed separately by composeImagePrompt.
 */
export function validateCinematicPromptSet(
  prompts: readonly CinematicPrompt[],
): ContractViolation[] {
  const violations: ContractViolation[] = []

  if (prompts.length !== TARGET_IMAGE_COUNT) {
    violations.push({
      code: "count",
      message: `Expected ${TARGET_IMAGE_COUNT} prompts, got ${prompts.length}`,
    })
  }

  prompts.forEach((prompt, index) => {
    const position = index + 1
    if (prompt.title.trim().length === 0) {
      violations.push({ code: "title", message: `Prompt ${position} is missing a title` })
    }
    if (prompt.cameraConcept.trim().length === 0) {
      violations.push({
        code: "cameraConcept",
        message: `Prompt ${position} is missing a camera concept`,
      })
    }
    if (prompt.prompt.trim().length < MIN_PROMPT_LENGTH) {
      violations.push({
        code: "length",
        message: `Prompt ${position} paragraph is under ${MIN_PROMPT_LENGTH} chars`,
      })
    }
  })

  const titles = prompts.map((prompt) => prompt.title.trim().toLowerCase())
  const bodies = prompts.map((prompt) => prompt.prompt.trim().toLowerCase())
  if (new Set(titles).size !== prompts.length) {
    violations.push({ code: "distinct-titles", message: "Prompt titles are not all distinct" })
  }
  if (new Set(bodies).size !== prompts.length) {
    violations.push({
      code: "distinct-prompts",
      message: "Prompt paragraphs are not all distinct",
    })
  }

  return violations
}

/** Throw a single readable error if the prompt set violates the contract. */
export function assertValidCinematicPromptSet(prompts: readonly CinematicPrompt[]): void {
  const violations = validateCinematicPromptSet(prompts)
  if (violations.length > 0) {
    throw new Error(
      `Prompt set violates the cinematic contract: ${violations
        .map((violation) => violation.message)
        .join("; ")}`,
    )
  }
}

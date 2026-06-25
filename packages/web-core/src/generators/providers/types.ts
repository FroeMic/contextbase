import type { CinematicPortraitsSourceBrief } from "../cinematic-portraits/source-brief"

/**
 * Raw bytes of a reference photo, loaded from storage and handed to a provider
 * so the model can preserve the subject's identity across generated images.
 */
export type ReferenceImage = {
  mimeType: string
  bytes: Uint8Array
}

/** One image's worth of creative direction produced by the prompt director. */
export type CinematicPrompt = {
  /** Short human-readable title, e.g. "Window-light desk study". */
  title: string
  /** Camera/composition concept, e.g. "35mm, eye-level, subject left third". */
  cameraConcept: string
  /** The creative paragraph. Base style + negatives are appended at send time. */
  prompt: string
}

export type ImageSize = "1024x1536" | "1024x1024" | "1536x1024"

export type GeneratedImage = {
  bytes: Uint8Array
  mimeType: string
  /** Some providers (OpenAI) return a rewritten prompt; recorded for provenance. */
  revisedPrompt?: string
}

/**
 * Provenance stamped onto every generated asset so an image is self-describing
 * forever — we always know the exact prompt and the model/provider that made it.
 */
export type GenerationMetadata = {
  provider: string
  model: string
  /** The fully composed prompt actually sent to the image model. */
  prompt: string
  revisedPrompt?: string
  size: string
  generatedAt: number
}

/** Turns a brief + reference photos into N distinct cinematic prompts. */
export interface TextPromptProvider {
  readonly id: string
  readonly model: string
  generatePrompts(input: {
    sourceBrief: CinematicPortraitsSourceBrief
    references: ReferenceImage[]
  }): Promise<CinematicPrompt[]>
}

/**
 * Turns one fully composed prompt string (+ reference photos) into one image.
 * The pipeline composes the structured CinematicPrompt into a string via
 * composeImagePrompt before calling this, so a retry can reuse the stored
 * string with no need to persist the structured prompt parts.
 */
export interface ImageProvider {
  readonly id: string
  readonly model: string
  generateImage(input: {
    prompt: string
    references: ReferenceImage[]
    size: ImageSize
  }): Promise<GeneratedImage>
}

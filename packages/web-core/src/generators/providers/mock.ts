import { TARGET_IMAGE_COUNT } from "./contract"
import type { CinematicPrompt, GeneratedImage, ImageProvider, TextPromptProvider } from "./types"

/**
 * Deterministic, network-free providers used as the default everywhere except
 * when a real provider is explicitly configured. They keep CI and the e2e flow
 * green without spending API credits, while exercising the exact same pipeline,
 * storage, and asset code paths as production.
 */

const MOCK_CAMERA_CONCEPTS = [
  "35mm lens, eye-level, subject placed on the left third with deep background",
  "50mm lens, slightly low angle, three-quarter turn toward a window light source",
  "85mm lens, shallow focus, subject mid-ground with soft foreground occlusion",
  "28mm lens, waist-up, environmental framing with leading lines into the scene",
  "wide establishing shot, high camera height, subject small within the setting",
  "over-the-shoulder framing, natural candid posture, midground depth cue",
  "tight profile composition, side light raking across the face, negative space ahead",
  "handheld documentary feel, eye-level, motion in the background midplane",
  "telephoto compression, subject separated from a layered distant background",
  "low golden-hour angle, backlight rim, foreground texture framing the subject",
] as const

function buildMockPrompt(seed: string, position: number): CinematicPrompt {
  const camera =
    MOCK_CAMERA_CONCEPTS[(position - 1) % MOCK_CAMERA_CONCEPTS.length] ?? MOCK_CAMERA_CONCEPTS[0]
  return {
    title: `Mock cinematic frame ${position}`,
    cameraConcept: camera,
    prompt:
      `Mock prompt ${position}. A real, natural photograph of the subject described below, ` +
      `shot as ${camera}. The scene reads as an authentic moment with believable light, ` +
      `texture, and atmosphere rather than a staged studio portrait. Lighting is bright and ` +
      `optimistic with open daylight and clear, readable features. Source brief follows so each ` +
      `frame stays grounded in the same person and intent. ${seed}`,
  }
}

export function createMockTextPromptProvider(): TextPromptProvider {
  return {
    id: "mock",
    model: "mock-prompt-director",
    async generatePrompts({ sourceBrief }) {
      return Array.from({ length: TARGET_IMAGE_COUNT }, (_, index) =>
        buildMockPrompt(sourceBrief.promptSeed, index + 1),
      )
    },
  }
}

// A valid 1x1 PNG. Decoded with atob (available in both the edge-style test VM
// and Node) so we never depend on Buffer. Real images come from the OpenAI
// provider; this is a stand-in that is a genuine PNG, not an SVG data URI.
const MOCK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export function createMockImageProvider(): ImageProvider {
  return {
    id: "mock",
    model: "mock-image",
    async generateImage({ prompt }: { prompt: string }): Promise<GeneratedImage> {
      return {
        bytes: base64ToBytes(MOCK_PNG_BASE64),
        mimeType: "image/png",
        revisedPrompt: prompt,
      }
    },
  }
}

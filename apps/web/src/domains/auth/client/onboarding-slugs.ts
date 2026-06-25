export type OnboardingSlugKind = "workspace"

const adjectives = [
  "bright",
  "calm",
  "clever",
  "curious",
  "daring",
  "focused",
  "gentle",
  "honest",
  "lively",
  "nimble",
  "steady",
  "vivid",
] as const

const nouns = [
  "atlas",
  "beacon",
  "comet",
  "harbor",
  "horizon",
  "kangaroo",
  "lantern",
  "meadow",
  "orbit",
  "summit",
  "voyage",
  "willow",
] as const

export function generateFriendlySlug(random: () => number = Math.random) {
  const adjective = adjectives[Math.floor(random() * adjectives.length)] ?? adjectives[0]
  const noun = nouns[Math.floor(random() * nouns.length)] ?? nouns[0]
  return `${adjective}-${noun}`
}

export function normalizeOnboardingSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

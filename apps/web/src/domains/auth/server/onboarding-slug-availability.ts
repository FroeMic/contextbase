import type { Db } from "@contextbase/core/db/client"
import { workspaceSlugAliases, workspaces } from "@contextbase/core/db/schema"
import { eq, or } from "drizzle-orm"

import {
  generateFriendlySlug,
  normalizeOnboardingSlug,
  type OnboardingSlugKind,
} from "../client/onboarding-slugs"

export async function isOnboardingSlugAvailable(input: {
  db: Db
  kind: OnboardingSlugKind
  slug: string
}) {
  const slug = normalizeOnboardingSlug(input.slug)
  if (!slug) return false

  const rows = await input.db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.workspaceSlug, slug))
    .limit(1)
  if (rows.length > 0) return false

  const aliases = await input.db
    .select({ id: workspaceSlugAliases.id })
    .from(workspaceSlugAliases)
    .where(or(eq(workspaceSlugAliases.oldSlug, slug), eq(workspaceSlugAliases.newSlug, slug)))
    .limit(1)
  return aliases.length === 0
}

export async function resolveAvailableOnboardingSlug(input: { db: Db; kind: OnboardingSlugKind }) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const slug = generateFriendlySlug()
    if (await isOnboardingSlugAvailable({ db: input.db, kind: input.kind, slug })) {
      return slug
    }
  }

  const fallback = `${generateFriendlySlug()}-${Date.now().toString(36).slice(-4)}`
  return normalizeOnboardingSlug(fallback)
}

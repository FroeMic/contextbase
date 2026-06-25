import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

const webSrc = join(process.cwd(), "src")
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..")

function exists(path: string) {
  return existsSync(join(webSrc, path))
}

function source(path: string) {
  return readFileSync(join(webSrc, path), "utf8")
}

describe("Contextbase web product surface", () => {
  test("does not register copied Vertical product routes", () => {
    expect(exists("routes/$businessSlug")).toBe(false)

    for (const routeFile of [
      "routes/friends.tsx",
      "routes/companies.tsx",
      "routes/changelog.tsx",
    ]) {
      expect(exists(routeFile), `${routeFile} should be removed`).toBe(false)
    }

    const routeTree = source("routeTree.gen.ts")
    for (const forbidden of [
      "BusinessSlug",
      "/$businessSlug",
      "/friends",
      "/companies",
      "/changelog",
      "contacts",
      "organizations",
      "goals",
      "tasks",
      "dashboard",
    ]) {
      expect(routeTree).not.toContain(forbidden)
    }
  })

  test("does not keep copied Vertical web product domains", () => {
    const forbiddenDomains = [
      "assistant",
      "businesses",
      "chats",
      "contacts",
      "dashboard",
      "goals",
      "organizations",
      "tasks",
    ]

    for (const domain of forbiddenDomains) {
      expect(exists(`domains/${domain}`), `domains/${domain} should be removed`).toBe(false)
    }
  })

  test("does not keep copied Vertical public landing helpers", () => {
    for (const path of [
      "domains/landing/components/friends-journey-timeline.tsx",
      "domains/landing/server/waitlist.ts",
      "domains/landing/server/waitlist.test.ts",
    ]) {
      expect(exists(path), `${path} should be removed`).toBe(false)
    }

    const serverApi = source("server-api.ts")
    expect(serverApi).not.toContain("/api/waitlist")
    expect(serverApi).not.toContain("handleLandingWaitlistRequest")
  })

  test("does not expose copied business auth or product file APIs", () => {
    const serverApi = source("server-api.ts")
    const authClient = source("domains/auth/client/auth-api.ts")
    const authHandlers = source("domains/auth/server/handlers.ts")
    const browserFileRoutes = source("domains/files/server/browser-file-routes.ts")
    const slugAvailability = source("domains/auth/server/onboarding-slug-availability.ts")

    for (const forbidden of [
      "/api/auth/business/select",
      "handleBusinessSelectRequest",
      "handleBusinessSelectRequest?",
      "selectBusiness",
      "switchBrowserSessionBusiness",
      "/api/settings/businesses/",
      "/api/settings/agents/",
      "/api/files/tasks/",
      "/api/files/contacts/",
      "/api/files/organizations/",
      "agent_avatar_upload",
      "business_avatar_upload",
      "chat_draft_upload",
      "contact_upload",
      "organization_upload",
      "uploadTaskFileAttachment",
      "uploadBusinessAvatar",
      "uploadAgentAvatar",
    ]) {
      expect(serverApi).not.toContain(forbidden)
      expect(authClient).not.toContain(forbidden)
      expect(authHandlers).not.toContain(forbidden)
      expect(browserFileRoutes).not.toContain(forbidden)
    }

    expect(slugAvailability).not.toContain("businessSlugAliases")
    expect(slugAvailability).not.toContain('kind === "business"')
    expect(source("domains/auth/client/onboarding-slugs.ts")).not.toContain('"business"')
  })

  test("does not keep copied client helpers for task/contact/organization files", () => {
    for (const path of [
      "domains/files/client/task-files.ts",
      "domains/files/client/contact-files.ts",
      "domains/files/client/organization-files.ts",
    ]) {
      expect(exists(path), `${path} should be removed`).toBe(false)
    }
  })

  test("file routes and public avatar helpers use Contextbase storage env names", () => {
    const browserFileRoutes = source("domains/files/server/browser-file-routes.ts")
    const publicAvatarUrl = source("domains/settings/client/public-avatar-url.ts")

    for (const sourceText of [browserFileRoutes, publicAvatarUrl]) {
      for (const forbidden of [
        "VERTICAL_STORAGE_",
        "VERTICAL_PUBLIC_ASSETS_",
        "VERTICAL_UPLOADS_",
        "public.vertical",
      ]) {
        expect(sourceText).not.toContain(forbidden)
      }
    }
  })

  test("local portless docs and scripts describe Contextbase services only", () => {
    const localDomains = readFileSync(join(repoRoot, "scripts/local-domains-portless.mjs"), "utf8")
    const caddyDocs = readFileSync(join(repoRoot, "docs/local-portless-caddy.md"), "utf8")

    for (const forbidden of ["convex", "Electric Visuals", "electric-visuals"]) {
      expect(localDomains).not.toContain(forbidden)
      expect(caddyDocs).not.toContain(forbidden)
    }

    for (const expected of [
      "contextbase",
      "api.contextbase",
      "uploads.contextbase",
      "zero.contextbase",
    ]) {
      expect(localDomains).toContain(expected)
      expect(caddyDocs).toContain(expected)
    }
  })

  test("web trpc router only mounts Contextbase relevant routers", () => {
    const trpcRouter = source("trpc/router.ts")

    expect(trpcRouter).toContain("settings: settingsRouter")

    for (const forbidden of [
      "businesses",
      "chats",
      "contacts",
      "dashboard",
      "goals",
      "organizations",
      "tasks",
      "providerRouter",
    ]) {
      expect(trpcRouter).not.toContain(forbidden)
    }
  })

  test("remaining top-level routes are Contextbase public and workspace surfaces", () => {
    const routeEntries = readdirSync(join(webSrc, "routes"), { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() ||
          (entry.isFile() && entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")),
      )
      .map((entry) => entry.name)
      .sort()

    expect(routeEntries).toEqual([
      "__root.tsx",
      "app",
      "auth.desktop.verify.tsx",
      "auth.invitations.accept.tsx",
      "auth.signup.verify.tsx",
      "auth.verify.tsx",
      "create.tsx",
      "index.tsx",
      "login.tsx",
      "onboarding.tsx",
      "workspaces.select.tsx",
    ])
  })
})

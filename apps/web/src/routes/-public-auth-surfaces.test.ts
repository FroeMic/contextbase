import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

const authRouteFiles = [
  "login.tsx",
  "create.tsx",
  "auth.desktop.verify.tsx",
  "auth.verify.tsx",
  "auth.signup.verify.tsx",
  "auth.invitations.accept.tsx",
  "workspaces.select.tsx",
]

function routeSource(file: string) {
  return readFileSync(join(process.cwd(), "src/routes", file), "utf8")
}

function screenSource(path: string) {
  return readFileSync(join(process.cwd(), "src/domains/auth/screens", path), "utf8")
}

function authComponentSource(path: string) {
  return readFileSync(join(process.cwd(), "src/domains/auth/components", path), "utf8")
}

describe("public and auth route surfaces", () => {
  test("keep route files as thin adapters to auth screens", () => {
    for (const file of authRouteFiles) {
      const source = routeSource(file)

      expect(source).toContain("../domains/auth/screens/")
      expect(source).not.toContain("<main")
      expect(source).not.toContain("<form")
      expect(source).not.toContain("<section")
      expect(source).not.toContain("<button")
      expect(source).not.toContain("<input")
    }
  })

  test("create route opens the account creation surface", () => {
    const routeSourceText = routeSource("create.tsx")

    expect(routeSourceText).toContain('createFileRoute("/create")')
    expect(routeSourceText).toContain("Route.useLoaderData")
    expect(routeSourceText).toContain("LoginPage")
    expect(routeSourceText).toContain("profilePlaceholder={session.profilePlaceholder}")
    expect(routeSourceText).toContain('initialMode="signup"')
  })

  test("use shared UI primitives instead of hand-rolled card, button, and input styles", () => {
    for (const file of [
      "AuthEntryPage.tsx",
      "DesktopVerifyPage.tsx",
      "InvitationAcceptPage.tsx",
      "LoginPage.tsx",
      "SignupVerifyPage.tsx",
      "VerifyPage.tsx",
      "WorkspaceSelectPage.tsx",
    ]) {
      const source = screenSource(file)

      expect(source).toContain("@/shared/ui/button")
      expect(source).not.toContain("<button")
      expect(source).not.toContain("<input")
      expect(source).not.toContain("border-neutral-")
      expect(source).not.toContain("bg-white")
      expect(source).not.toContain("text-neutral-")
    }
  })

  test("renders router links through Button without native button semantics", () => {
    for (const file of ["VerifyPage.tsx", "SignupVerifyPage.tsx", "WorkspaceSelectPage.tsx"]) {
      const source = screenSource(file)

      expect(source).toContain("nativeButton={false}")
      expect(source).toContain("render={<Link")
    }
  })

  test("root serves the new landing page and resolves signed-in CTA state on the server", () => {
    expect(routeSource("index.tsx")).toContain("LandingHomePage")
    expect(routeSource("index.tsx")).toContain("getLandingSessionState")
    expect(routeSource("index.tsx")).toContain("isSignedIn={session.isSignedIn}")
  })

  test("login keeps its normal page and signed-in session chooser", () => {
    expect(routeSource("login.tsx")).toContain("LoginPage")
    expect(routeSource("login.tsx")).toContain("getLoginSessionState")
    expect(routeSource("login.tsx")).toContain("Route.useLoaderData")
    expect(routeSource("login.tsx")).toContain("session={session.session}")

    const source = screenSource("LoginPage.tsx")
    expect(source).toContain("AuthEntrySelector")
    expect(source).not.toContain("<AuthEntryPage")
    expect(source).not.toContain("SignedInCard")

    const authEntrySource = screenSource("AuthEntryPage.tsx")
    expect(authEntrySource).toContain("Signed in as")
    expect(authEntrySource).toContain("logout")
  })

  test("login uses the split auth layout with a dot shader panel", () => {
    const source = screenSource("LoginPage.tsx")

    expect(source).toContain("lg:grid-cols-2")
    expect(source).toContain("Contextbase")
    expect(source).toContain("Sign in to Contextbase")
    expect(source).not.toContain("/vertical-logo.png")
    expect(source).not.toContain('alt="Vertical"')
    expect(source).not.toContain("Sign in to Vertical")
    expect(source).toContain("DotsShader")
    expect(source).toContain("bg-black")
    expect(source).toContain("items-start justify-center pt-20")
    expect(source).not.toContain("flex-1 items-center justify-center")
    expect(source).toContain("Send magic link")
    expect(source).not.toContain("Use the email attached to your user.")
    expect(source).not.toContain("placeholder.svg")

    const shaderSource = authComponentSource("DotsShader.tsx")
    expect(shaderSource).toContain("webgl2")
    expect(shaderSource).toContain("requestAnimationFrame")
    expect(shaderSource).toContain("ResizeObserver")
    expect(shaderSource).toContain("colors = [")
  })

  test("logged-out login can switch to password auth and reuse post-login redirects", () => {
    const source = screenSource("LoginPage.tsx")

    expect(source).toContain("Login with e-mail and password instead")
    expect(source).toContain("PasswordLoginForm")
    expect(source).toContain("loginWithPassword")
    expect(source).toContain("fetchCurrentSession")
    expect(source).toContain("selectPostLoginRedirect")
    expect(source).toContain("readWorkspaceSelectionPreference")
    expect(source).toContain("Use a magic link")
  })

  test("logged-out login can switch to self-serve signup", () => {
    const source = screenSource("LoginPage.tsx")
    const signupSource = source.slice(source.indexOf("function SignupForm()"))

    expect(source).toContain('"signup"')
    expect(source).toContain("SignupForm")
    expect(source).toContain("requestSignupVerification")
    expect(signupSource).toContain("readOnly={isSent || isSubmitting}")
    expect(source).toContain("Create an account")
    expect(source).not.toContain("Create a workspace")
    expect(source).not.toContain("Verify your email before setting up your workspace.")
    expect(source).toContain('to="/create"')
    expect(source).toContain("Already have an account?")
  })

  test("auth client exposes signup verification helpers", () => {
    const source = readFileSync(join(process.cwd(), "src/domains/auth/client/auth-api.ts"), "utf8")

    expect(source).toContain("requestSignupVerification")
    expect(source).toContain('"/api/auth/signup/request"')
    expect(source).toContain("consumeSignupVerification")
    expect(source).toContain('"/api/auth/signup/consume"')
    expect(source).toContain("completeSignupOnboarding")
    expect(source).toContain('"/api/auth/onboarding/complete"')
    expect(source).toContain("acceptWorkspaceInvitation")
    expect(source).toContain('"/api/auth/invitations/accept"')
  })

  test("signup verification route consumes token and redirects to onboarding", () => {
    const routeSourceText = routeSource("auth.signup.verify.tsx")
    const source = screenSource("SignupVerifyPage.tsx")

    expect(routeSourceText).toContain('createFileRoute("/auth/signup/verify")')
    expect(source).toContain("consumeSignupVerification")
    expect(source).toContain('window.location.assign("/create")')
    expect(source).toContain("Signup verification failed")
  })

  test("desktop verification route hands hosted links to the Electron protocol", () => {
    const routeSourceText = routeSource("auth.desktop.verify.tsx")
    const source = screenSource("DesktopVerifyPage.tsx")

    expect(routeSourceText).toContain('createFileRoute("/auth/desktop/verify")')
    expect(routeSourceText).toContain("DesktopVerifyPage")
    expect(source).toContain("desktopMagicLinkVerifyUrl")
    expect(source).toContain("buildDesktopMagicLinkHandoffUrl")
    expect(source).toContain("contextbase://open")
    expect(source).toContain("Continue in browser")
  })

  test("workspace invitation route accepts token and redirects after login", () => {
    const routeSourceText = routeSource("auth.invitations.accept.tsx")
    const source = screenSource("InvitationAcceptPage.tsx")

    expect(routeSourceText).toContain('createFileRoute("/auth/invitations/accept")')
    expect(source).toContain("acceptWorkspaceInvitation")
    expect(source).toContain("selectPostLoginRedirect")
    expect(source).toContain("let invitationAccepted = false")
    expect(source).toContain("invitationAccepted = true")
    expect(source).toContain("fetchCurrentSession().catch(() => null)")
    expect(source.indexOf("invitationAccepted = true")).toBeLessThan(
      source.indexOf("fetchCurrentSession().catch(() => null)"),
    )
    expect(source.indexOf("if (!invitationAccepted)")).toBeLessThan(
      source.indexOf("fetchCurrentSession().catch(() => null)"),
    )
    expect(source).toContain("Invitation failed")
  })

  test("onboarding route renders the first-run stepper", () => {
    const routeSourceText = routeSource("onboarding.tsx")
    const source = screenSource("OnboardingPage.tsx")

    expect(routeSourceText).toContain('createFileRoute("/onboarding")')
    expect(source).toContain("Set up your profile")
    expect(source).toContain("AvatarImageUploader")
    expect(source).toContain("Verified email")
    expect(source).toContain("readOnly")
    expect(source).not.toContain("setProfileTitle")
    expect(source).not.toContain("profileTitle")
    expect(source).not.toContain(">Title<")
    expect(source).toContain("profilePlaceholderExamples")
    expect(source).toContain("Marty McFly")
    expect(source).toContain("John Connor")
    expect(source).toContain("selectRandomProfilePlaceholder")
    expect(source).toContain("generatedWorkspaceSlug")
    expect(source).not.toContain("generatedBusinessSlug")
    expect(source).not.toContain("setProfilePlaceholder")
    expect(source).not.toContain('placeholder="Moody Mike"')
    expect(source).not.toContain('placeholder="Software engineer"')
    expect(source).toContain("Create your workspace")
    expect(source).toContain("Workspace slug")
    expect(source).toContain("checkOnboardingSlugAvailability")
    expect(source).toContain("setTimeout")
    expect(source).not.toContain("Business slug")
    expect(source).not.toContain("TabsList")
    expect(source).not.toContain("TabsTrigger")
    expect(source).not.toContain("I have a business")
    expect(source).not.toContain("I have an idea")
    expect(source).not.toContain("New business")
    expect(source).not.toContain("Existing business")
    expect(source).not.toContain("businessAvatarBlob")
    expect(source).not.toContain("uploadOnboardingBusinessAvatar")
    expect(source).not.toContain("Profile photo")
    expect(source).not.toContain("Upload a public avatar for your account.")
    expect(source).toContain("currentStep === 0 ? (")
    expect(source).toContain('aria-hidden="true" className="invisible h-10 w-20"')
    expect(source).toContain("min-h-[560px]")
    expect(source).toContain("grid-rows-[auto_1fr_auto]")
    expect(source).not.toContain("Connect your coding agent")
    expect(source).not.toContain("vertical workspaces list")
    expect(source).not.toContain("vertical workspaces use")
    expect(source).toContain("currentStep")
    expect(source).toContain("completeSignupOnboarding")
    expect(source).toContain("selectPostLoginRedirect")

    expect(routeSourceText).toContain("Route.useLoaderData")
    expect(routeSourceText).toContain("profilePlaceholder={state.profilePlaceholder}")
    expect(routeSource("create.tsx")).toContain(
      "generatedWorkspaceSlug={session.generatedWorkspaceSlug}",
    )
    expect(routeSource("create.tsx")).not.toContain("generatedBusinessSlug")
  })

  test("signed-in login state renders the selector from loader data instead of fetching after paint", () => {
    const source = screenSource("LoginPage.tsx")
    const signedInIndex = source.indexOf("AuthEntrySelector")
    const formIndex = source.indexOf("MagicLinkForm")

    expect(signedInIndex).toBeGreaterThan(-1)
    expect(formIndex).toBeGreaterThan(signedInIndex)
    expect(source).toContain("session ?")

    const authEntrySource = screenSource("AuthEntryPage.tsx")
    expect(authEntrySource).toContain("initialSession")
    expect(authEntrySource).toContain("if (initialSession)")
  })
})

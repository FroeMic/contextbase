export interface LandingHomePageProps {
  isSignedIn: boolean
}

export function LandingHomePage({ isSignedIn }: LandingHomePageProps) {
  return (
    <main className="contextbase-landing" data-signed-in={isSignedIn ? "true" : "false"}>
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static scoped CSS for the text-only landing page.
        dangerouslySetInnerHTML={{ __html: landingStyles }}
      />
      <section aria-label="Contextbase" className="landing-fold">
        <p className="landing-kicker">Contextbase</p>
        <h1>Workspace Memory for AI Sessions</h1>
        <p className="landing-copy">
          Contextbase is the local-first foundation for captured AI chats, coding sessions, and
          agent runs. Workspaces, auth, settings, files, API, MCP, and Postgres are ready; provider
          capture arrives through focused OpenSpec changes.
        </p>
      </section>
    </main>
  )
}

const landingStyles = `
.contextbase-landing,
.contextbase-landing * {
  box-sizing: border-box;
}

.contextbase-landing {
  align-items: center;
  background: #f7f6f2;
  color: #171717;
  display: flex;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  min-height: 100vh;
  padding: 32px;
}

.landing-fold {
  max-width: 760px;
}

.landing-kicker {
  color: #68645d;
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 22px;
}

.landing-fold h1 {
  font-size: clamp(42px, 8vw, 84px);
  font-weight: 650;
  letter-spacing: 0;
  line-height: 0.98;
  margin: 0;
  max-width: 820px;
}

.landing-copy {
  color: #3d3a36;
  font-size: clamp(18px, 2.2vw, 24px);
  line-height: 1.45;
  margin: 28px 0 0;
  max-width: 720px;
}

@media (max-width: 640px) {
  .contextbase-landing {
    align-items: flex-start;
    padding: 28px 22px;
  }

  .landing-fold {
    padding-top: 14vh;
  }

  .landing-copy {
    font-size: 18px;
  }
}
`

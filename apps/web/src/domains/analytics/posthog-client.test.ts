import { beforeEach, describe, expect, test, vi } from "vitest"

import {
  capturePostHogBrowserEvent,
  capturePostHogBrowserException,
  identifyPostHogBrowserSession,
  initPostHogBrowserAnalytics,
  resetPostHogBrowserAnalyticsForTest,
  resetPostHogBrowserSession,
} from "./posthog-client"

const posthog = vi.hoisted(() => ({
  capture: vi.fn(),
  captureException: vi.fn(),
  identify: vi.fn(),
  init: vi.fn(),
  reset: vi.fn(),
}))

vi.mock("posthog-js", () => ({
  default: posthog,
}))

describe("PostHog browser client", () => {
  beforeEach(() => {
    posthog.capture.mockReset()
    posthog.captureException.mockReset()
    posthog.identify.mockReset()
    posthog.init.mockReset()
    posthog.reset.mockReset()
    resetPostHogBrowserAnalyticsForTest()
    vi.stubGlobal("window", {})
    delete window.__CONTEXTBASE_POSTHOG__
  })

  test("does not initialize without server-injected config", () => {
    expect(initPostHogBrowserAnalytics()).toBe(false)
    expect(posthog.init).not.toHaveBeenCalled()
  })

  test("initializes once with the server-injected proxy config", () => {
    window.__CONTEXTBASE_POSTHOG__ = {
      apiHost: "/ingest",
      enabled: true,
      environment: "production",
      token: "phc_test",
      uiHost: "https://eu.posthog.com",
    }

    expect(initPostHogBrowserAnalytics()).toBe(true)
    expect(initPostHogBrowserAnalytics()).toBe(false)
    expect(posthog.init).toHaveBeenCalledTimes(1)
    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        api_host: "/ingest",
        autocapture: false,
        capture_exceptions: {
          capture_console_errors: false,
          capture_unhandled_errors: true,
          capture_unhandled_rejections: true,
        },
        capture_pageview: "history_change",
        disable_session_recording: true,
        ui_host: "https://eu.posthog.com",
      }),
    )
  })

  test("captures events only when config is present", () => {
    capturePostHogBrowserEvent("landing_view", { source: "home" })
    expect(posthog.capture).not.toHaveBeenCalled()

    window.__CONTEXTBASE_POSTHOG__ = {
      apiHost: "/ingest",
      enabled: true,
      environment: "production",
      token: "phc_test",
      uiHost: "https://eu.posthog.com",
    }

    capturePostHogBrowserEvent("landing_view", { source: "home" })
    expect(posthog.capture).toHaveBeenCalledWith("landing_view", { source: "home" }, undefined)
  })

  test("does not throw when PostHog SDK browser calls fail", () => {
    window.__CONTEXTBASE_POSTHOG__ = {
      apiHost: "/ingest",
      enabled: true,
      environment: "production",
      token: "phc_test",
      uiHost: "https://eu.posthog.com",
    }

    posthog.init.mockImplementationOnce(() => {
      throw new Error("init failed")
    })
    posthog.capture.mockImplementationOnce(() => {
      throw new Error("capture failed")
    })
    posthog.captureException.mockImplementationOnce(() => {
      throw new Error("exception failed")
    })
    posthog.identify.mockImplementationOnce(() => {
      throw new Error("identify failed")
    })

    expect(() => initPostHogBrowserAnalytics()).not.toThrow()
    expect(() => capturePostHogBrowserEvent("landing_view")).not.toThrow()
    expect(() => capturePostHogBrowserException("boom")).not.toThrow()
    expect(() =>
      identifyPostHogBrowserSession({
        email: "m@example.com",
        sessionId: "ses_123",
      }),
    ).not.toThrow()
  })

  test("captures exceptions only when config is present", () => {
    capturePostHogBrowserException("boom", { route_pathname: "/tasks" })
    expect(posthog.captureException).not.toHaveBeenCalled()

    window.__CONTEXTBASE_POSTHOG__ = {
      apiHost: "/ingest",
      enabled: true,
      environment: "production",
      token: "phc_test",
      uiHost: "https://eu.posthog.com",
    }

    capturePostHogBrowserException("boom", { route_pathname: "/tasks" })
    expect(posthog.captureException).toHaveBeenCalledWith(expect.any(Error), {
      environment: "production",
      route_pathname: "/tasks",
      service_name: "vertical-web",
      surface: "web",
    })
  })

  test("identifies authenticated browser sessions by email when config is present", () => {
    identifyPostHogBrowserSession({
      activeWorkspaceId: "wrk_123",
      activeWorkspaceSlug: "core",
      email: " M@Example.com ",
      sessionId: "ses_123",
      userId: "usr_123",
    })
    expect(posthog.identify).not.toHaveBeenCalled()

    window.__CONTEXTBASE_POSTHOG__ = {
      apiHost: "/ingest",
      enabled: true,
      environment: "production",
      token: "phc_test",
      uiHost: "https://eu.posthog.com",
    }

    expect(
      identifyPostHogBrowserSession({
        activeWorkspaceId: "wrk_123",
        activeWorkspaceSlug: "core",
        email: " M@Example.com ",
        sessionId: "ses_123",
        userId: "usr_123",
      }),
    ).toBe(true)
    expect(posthog.identify).toHaveBeenCalledWith("m@example.com", {
      active_workspace_id: "wrk_123",
      active_workspace_slug: "core",
      email: "m@example.com",
      session_id: "ses_123",
      user_id: "usr_123",
    })
  })

  test("does not repeat identify calls for the same authenticated browser session", () => {
    window.__CONTEXTBASE_POSTHOG__ = {
      apiHost: "/ingest",
      enabled: true,
      environment: "production",
      token: "phc_test",
      uiHost: "https://eu.posthog.com",
    }

    const session = {
      activeWorkspaceId: "wrk_123",
      activeWorkspaceSlug: "core",
      email: "m@example.com",
      sessionId: "ses_123",
      userId: "usr_123",
    }

    expect(identifyPostHogBrowserSession(session)).toBe(true)
    expect(identifyPostHogBrowserSession(session)).toBe(false)
    expect(posthog.identify).toHaveBeenCalledTimes(1)
  })

  test("re-identifies when the authenticated workspace changes in the same session", () => {
    window.__CONTEXTBASE_POSTHOG__ = {
      apiHost: "/ingest",
      enabled: true,
      environment: "production",
      token: "phc_test",
      uiHost: "https://eu.posthog.com",
    }

    expect(
      identifyPostHogBrowserSession({
        activeWorkspaceId: "wrk_one",
        activeWorkspaceSlug: "one",
        email: "m@example.com",
        sessionId: "ses_123",
        userId: "usr_123",
      }),
    ).toBe(true)
    expect(
      identifyPostHogBrowserSession({
        activeWorkspaceId: "wrk_two",
        activeWorkspaceSlug: "two",
        email: "m@example.com",
        sessionId: "ses_123",
        userId: "usr_123",
      }),
    ).toBe(true)

    expect(posthog.identify).toHaveBeenCalledTimes(2)
    expect(posthog.identify).toHaveBeenLastCalledWith(
      "m@example.com",
      expect.objectContaining({
        active_workspace_id: "wrk_two",
        active_workspace_slug: "two",
      }),
    )
  })

  test("resets identified browser sessions without throwing when PostHog fails", () => {
    expect(resetPostHogBrowserSession()).toBe(false)
    expect(posthog.reset).not.toHaveBeenCalled()

    window.__CONTEXTBASE_POSTHOG__ = {
      apiHost: "/ingest",
      enabled: true,
      environment: "production",
      token: "phc_test",
      uiHost: "https://eu.posthog.com",
    }

    expect(resetPostHogBrowserSession()).toBe(true)
    expect(posthog.reset).toHaveBeenCalledTimes(1)

    posthog.reset.mockImplementationOnce(() => {
      throw new Error("reset failed")
    })

    expect(() => resetPostHogBrowserSession()).not.toThrow()
  })

  test("resets the browser identity when the authenticated session is absent", () => {
    window.__CONTEXTBASE_POSTHOG__ = {
      apiHost: "/ingest",
      enabled: true,
      environment: "production",
      token: "phc_test",
      uiHost: "https://eu.posthog.com",
    }

    identifyPostHogBrowserSession({
      email: "m@example.com",
      sessionId: "ses_123",
    })
    expect(posthog.identify).toHaveBeenCalledTimes(1)

    expect(identifyPostHogBrowserSession(null)).toBe(false)
    expect(posthog.reset).toHaveBeenCalledTimes(1)

    identifyPostHogBrowserSession({
      email: "m@example.com",
      sessionId: "ses_123",
    })
    expect(posthog.identify).toHaveBeenCalledTimes(2)
  })

  test("redacts sensitive exception event properties before sending", () => {
    window.__CONTEXTBASE_POSTHOG__ = {
      apiHost: "/ingest",
      enabled: true,
      environment: "production",
      token: "phc_test",
      uiHost: "https://eu.posthog.com",
    }

    initPostHogBrowserAnalytics()
    const options = posthog.init.mock.calls[0]?.[1]
    const event = options.before_send({
      event: "$exception",
      properties: {
        authorization: "Bearer secret",
        nested: {
          apiToken: "secret",
          safe: "value",
        },
        route_pathname: "/tasks",
        tokenHash: "secret",
      },
    })

    expect(event.properties).toEqual({
      authorization: "[redacted]",
      environment: "production",
      nested: {
        apiToken: "[redacted]",
        safe: "value",
      },
      route_pathname: "/tasks",
      service_name: "vertical-web",
      surface: "web",
      tokenHash: "[redacted]",
    })
  })

  test("enriches SDK-captured exception events before sending", () => {
    window.__CONTEXTBASE_POSTHOG__ = {
      apiHost: "/ingest",
      enabled: true,
      environment: "staging",
      serviceVersion: "sha_123",
      token: "phc_test",
      uiHost: "https://eu.posthog.com",
    }

    initPostHogBrowserAnalytics()
    const options = posthog.init.mock.calls[0]?.[1]
    const event = options.before_send({
      event: "$exception",
      properties: {
        route_pathname: "/tasks",
      },
    })

    expect(event.properties).toMatchObject({
      environment: "staging",
      route_pathname: "/tasks",
      service_name: "vertical-web",
      service_version: "sha_123",
      surface: "web",
    })
  })
})

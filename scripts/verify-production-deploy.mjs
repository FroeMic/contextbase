#!/usr/bin/env node

const config = {
  apiBaseUrl: envUrl("CONTEXTBASE_API_PUBLIC_BASE_URL", "https://api.contextbase.localhost"),
  appBaseUrl: envUrl("CONTEXTBASE_APP_BASE_URL", "https://contextbase.localhost"),
  uploadsBaseUrl: envUrl(
    "CONTEXTBASE_UPLOADS_PUBLIC_BASE_URL",
    "https://uploads.contextbase.localhost",
  ),
}

const checks = []

await checkApiHealth()
await checkConsole()
await checkUploadsBrowserRoute()

const failed = checks.filter((check) => check.status === "fail")
for (const check of checks) {
  const marker = check.status === "pass" ? "✓" : "✗"
  console.log(`${marker} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`)
}

if (failed.length > 0) {
  console.error(`\n${failed.length} production deploy check(s) failed.`)
  process.exit(1)
}

console.log("\nProduction deploy config checks passed.")

async function checkApiHealth() {
  const url = new URL("/healthz", config.apiBaseUrl)
  try {
    const response = await fetch(url)
    const payload = await response.json().catch(() => null)
    const ok = response.ok && payload?.ok === true && payload?.data?.status === "ok"
    record("API health", ok, `${response.status} ${url}`)
  } catch (error) {
    record("API health", false, errorMessage(error))
  }
}

async function checkConsole() {
  try {
    const response = await fetch(config.appBaseUrl, { redirect: "manual" })
    const contentType = response.headers.get("content-type") ?? ""
    const ok = response.status === 200 && contentType.includes("text/html")
    record("Console web root", ok, `${response.status} ${config.appBaseUrl}`)
  } catch (error) {
    record("Console web root", false, errorMessage(error))
  }
}

async function checkUploadsBrowserRoute() {
  const url = new URL("/nonexistent-file/content", config.uploadsBaseUrl)
  try {
    const response = await fetch(url)
    const contentType = response.headers.get("content-type") ?? ""
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : null
    const ok =
      response.status === 401 &&
      payload?.ok === false &&
      payload?.error?.code === "unauthenticated" &&
      /browser session/i.test(payload?.error?.message ?? "")
    record(
      "Uploads host uses browser-auth file route",
      ok,
      `${response.status} ${url}${payload?.error?.message ? ` (${payload.error.message})` : ""}`,
    )
  } catch (error) {
    record("Uploads host uses browser-auth file route", false, errorMessage(error))
  }
}

function envUrl(name, fallback) {
  return (process.env[name] ?? fallback).replace(/\/+$/, "")
}

function record(name, passed, detail) {
  checks.push({ name, status: passed ? "pass" : "fail", detail })
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const repo = process.env.CONTEXTBASE_REPO ?? path.resolve(import.meta.dirname, "..")
const root = process.env.CONTEXTBASE_WEBSTACK_ROOT ?? "/opt/webstack"

function run(command, args, opts = {}) {
  const quiet = opts.quiet ?? false
  if (!quiet) console.error(`$ ${[command, ...args].join(" ")}`)
  const result = spawnSync(command, args, {
    cwd: opts.cwd ?? repo,
    encoding: "utf8",
    stdio: opts.stdio ?? "pipe",
  })
  if (result.stdout && !quiet) process.stdout.write(result.stdout)
  if (result.stderr && !quiet) process.stderr.write(result.stderr)
  if (result.status !== 0)
    throw new Error(`Command failed (${result.status}): ${[command, ...args].join(" ")}`)
  return result.stdout || ""
}
function capture(command, args, opts = {}) {
  return execFileSync(command, args, { cwd: opts.cwd ?? repo, encoding: "utf8" }).trim()
}
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}
function envFrom(container, fallback = null) {
  try {
    const raw = capture("docker", ["inspect", container, "--format", "{{json .Config.Env}}"])
    const entries = JSON.parse(raw)
    const env = {}
    for (const item of entries) {
      const idx = item.indexOf("=")
      if (idx > -1) env[item.slice(0, idx)] = item.slice(idx + 1)
    }
    return env
  } catch (error) {
    if (fallback) return { ...fallback }
    throw error
  }
}
function writeEnv(env, prefix) {
  const file = path.join(
    "/tmp",
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.env`,
  )
  fs.writeFileSync(
    file,
    `${Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n")}\n`,
  )
  return file
}
function rm(name) {
  spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" })
}
function inspectIp(container, network) {
  return capture("docker", [
    "inspect",
    "-f",
    `{{index .NetworkSettings.Networks "${network}" "IPAddress"}}`,
    container,
  ])
}
function checkHealth(url, timeoutSeconds = 45) {
  const deadline = Date.now() + timeoutSeconds * 1000
  while (Date.now() < deadline) {
    const r = spawnSync("curl", ["-fsS", "--max-time", "5", url], { encoding: "utf8" })
    if (r.status === 0) return true
    sleep(1000)
  }
  return false
}
function currentColor(fragmentPath, prefix) {
  const text = fs.readFileSync(fragmentPath, "utf8")
  const match = text.match(new RegExp(`${prefix}-(blue|green)`))
  return match ? match[1] : null
}
function patchFragments(files, replacements) {
  const previous = new Map()
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8")
    previous.set(file, text)
    let next = text
    for (const [from, to] of replacements) next = next.replaceAll(from, to)
    fs.writeFileSync(file, next)
  }
  return previous
}
function restore(previous) {
  for (const [file, text] of previous) fs.writeFileSync(file, text)
}
function reloadCaddySafe() {
  run("docker", ["exec", "webstack-caddy", "caddy", "validate", "--config", "/etc/caddy/Caddyfile"])
  run("docker", ["exec", "webstack-caddy", "caddy", "reload", "--config", "/etc/caddy/Caddyfile"])
}
function runContainer({ name, image, network, envFile, cmd, volumes = [], proxy = false }) {
  rm(name)
  const args = [
    "run",
    "-d",
    "--name",
    name,
    "--restart",
    "unless-stopped",
    "--network",
    network,
    "--env-file",
    envFile,
  ]
  for (const [volume, dest] of volumes) args.push("-v", `${volume}:${dest}`)
  args.push(image, ...cmd)
  run("docker", args, { quiet: true })
  if (proxy) run("docker", ["network", "connect", "webstack_proxy", name], { quiet: true })
}
function oneShot({ image, network, envFile, cmd }) {
  run("docker", ["run", "--rm", "--network", network, "--env-file", envFile, image, ...cmd])
}
function writeReceipt(target, payload) {
  const dir = path.join(root, "apps", "contextbase", target, "releases")
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, `${Date.now()}-contextbase-deploy.json`),
    `${JSON.stringify(payload, null, 2)}\n`,
  )
}
function writeCaddySite(file, hostname, upstream) {
  fs.writeFileSync(file, `${hostname} {\n    encode zstd gzip\n    reverse_proxy ${upstream}\n}\n`)
}
function forcePublicDatabaseSearchPath(env) {
  env.DATABASE_SEARCH_PATH = "public"
  return env
}

const configs = {
  staging: {
    imageBase: "contextbase-staging-runtime",
    zeroUrl: "https://zero.staging.contextbase.localhost",
    network: "contextbase-staging",
    apiPrefix: "contextbase-staging-api",
    webPrefix: "contextbase-staging-web",
    liveFragment: "/opt/webstack/caddy/sites/staging.contextbase.localhost.caddy",
    fragments: [
      "/opt/webstack/caddy/sites/staging.contextbase.localhost.caddy",
      "/opt/webstack/caddy/sites/api.staging.contextbase.localhost.caddy",
      "/opt/webstack/caddy/sites/uploads.staging.contextbase.localhost.caddy",
      "/opt/webstack/caddy/sites/public.staging.contextbase.localhost.caddy",
    ],
    currentApi: "contextbase-staging-api-blue",
    currentWeb: "contextbase-staging-web-blue",
    zero: "contextbase-staging-zero-cache",
    auth: "contextbase-staging-auth",
    mcp: "contextbase-staging-mcp",
    uploadVolume: "contextbase_staging_uploads",
    zeroVolume: "contextbase_staging_zero_data",
    publicAssetsBaseUrl: "https://public.staging.contextbase.localhost",
    appBaseUrl: "https://staging.contextbase.localhost",
    apiBaseUrl: "https://api.staging.contextbase.localhost",
    authBaseUrl: "https://auth.staging.contextbase.localhost",
    mcpBaseUrl: "https://mcp.staging.contextbase.localhost",
    uploadsBaseUrl: "https://uploads.staging.contextbase.localhost",
    publicHealth: "https://staging.contextbase.localhost/healthz",
    authFragment: "/opt/webstack/caddy/sites/auth.staging.contextbase.localhost.caddy",
    mcpFragment: "/opt/webstack/caddy/sites/mcp.staging.contextbase.localhost.caddy",
  },
  prod: {
    imageBase: "contextbase-prod-runtime",
    zeroUrl: "https://zero.contextbase.localhost",
    network: "contextbase_default",
    apiPrefix: "contextbase-api",
    webPrefix: "contextbase-web",
    liveFragment: "/opt/webstack/caddy/sites/contextbase.localhost.caddy",
    fragments: [
      "/opt/webstack/caddy/sites/contextbase.localhost.caddy",
      "/opt/webstack/caddy/sites/api.contextbase.localhost.caddy",
      "/opt/webstack/caddy/sites/uploads.contextbase.localhost.caddy",
      "/opt/webstack/caddy/sites/public.contextbase.localhost.caddy",
    ],
    currentApi: "contextbase-api-green",
    currentWeb: "contextbase-web-green",
    zero: "contextbase-zero-cache-prod",
    auth: "contextbase-auth",
    mcp: "contextbase-mcp",
    uploadVolume: "contextbase_contextbase_uploads",
    zeroVolume: "contextbase_contextbase_zero_data",
    publicAssetsBaseUrl: "https://public.contextbase.localhost",
    appBaseUrl: "https://contextbase.localhost",
    apiBaseUrl: "https://api.contextbase.localhost",
    authBaseUrl: "https://auth.contextbase.localhost",
    mcpBaseUrl: "https://mcp.contextbase.localhost",
    uploadsBaseUrl: "https://uploads.contextbase.localhost",
    publicHealth: "https://contextbase.localhost/healthz",
    authFragment: "/opt/webstack/caddy/sites/auth.contextbase.localhost.caddy",
    mcpFragment: "/opt/webstack/caddy/sites/mcp.contextbase.localhost.caddy",
  },
}

function buildSharedServiceEnv(cfg, baseApiEnv, newWeb) {
  return {
    ...baseApiEnv,
    DATABASE_SEARCH_PATH: "public",
    AUTH_HOST: "0.0.0.0",
    AUTH_PORT: "3317",
    AUTH_PUBLIC_BASE_URL: cfg.authBaseUrl,
    MCP_HOST: "0.0.0.0",
    MCP_PORT: "3217",
    MCP_PUBLIC_BASE_URL: cfg.mcpBaseUrl,
    NODE_ENV: "production",
    CONTEXTBASE_APP_BASE_URL: cfg.appBaseUrl,
    CONTEXTBASE_API_PUBLIC_BASE_URL: cfg.apiBaseUrl,
    CONTEXTBASE_API_RESOURCE_URL: `${cfg.apiBaseUrl}/api/v1`,
    CONTEXTBASE_AUTH_BASE_URL: cfg.authBaseUrl,
    VITE_CONTEXTBASE_AUTH_BASE_URL: cfg.authBaseUrl,
    CONTEXTBASE_MCP_RESOURCE_URL: `${cfg.mcpBaseUrl}/mcp`,
    CONTEXTBASE_PUBLIC_ASSETS_BASE_URL: cfg.publicAssetsBaseUrl,
    CONTEXTBASE_UPLOADS_INTERNAL_BASE_URL: `http://${newWeb}:4017/api/files`,
    CONTEXTBASE_UPLOADS_PUBLIC_BASE_URL: cfg.uploadsBaseUrl,
    CONTEXTBASE_WEB_BASE_URL: cfg.appBaseUrl,
    CONTEXTBASE_STORAGE_PROVIDER: baseApiEnv.CONTEXTBASE_STORAGE_PROVIDER ?? "local_disk",
    CONTEXTBASE_STORAGE_LOCAL_DIR: "/data/uploads",
  }
}

async function deploy(target) {
  const cfg = configs[target]
  if (!cfg) throw new Error(`Unknown target ${target}`)
  console.error(`\n# Deploying ${target}`)
  const sha = capture("git", ["rev-parse", "--short=7", "HEAD"])
  const ts = Date.now()
  const image = `${cfg.imageBase}:${sha}-${ts}`
  run(
    "docker",
    [
      "build",
      "--build-arg",
      `VITE_ZERO_CACHE_URL=${cfg.zeroUrl}`,
      "--build-arg",
      `VITE_CONTEXTBASE_AUTH_BASE_URL=${cfg.authBaseUrl}`,
      "-t",
      image,
      "-f",
      "Dockerfile",
      ".",
    ],
    { stdio: "inherit" },
  )

  const liveWebColor = currentColor(cfg.liveFragment, cfg.webPrefix)
  const liveApiColor = currentColor(cfg.fragments[1], cfg.apiPrefix) ?? liveWebColor
  const candidateWebColor = liveWebColor === "blue" ? "green" : "blue"
  const candidateApiColor = liveApiColor === "blue" ? "green" : "blue"
  const oldApi = liveApiColor ? `${cfg.apiPrefix}-${liveApiColor}` : cfg.currentApi
  const oldWeb = liveWebColor ? `${cfg.webPrefix}-${liveWebColor}` : cfg.currentWeb
  const newApi = `${cfg.apiPrefix}-${candidateApiColor}`
  const newWeb = `${cfg.webPrefix}-${candidateWebColor}`
  console.error(
    `# liveApi=${liveApiColor ?? "unknown"} candidateApi=${candidateApiColor} liveWeb=${liveWebColor ?? "unknown"} candidateWeb=${candidateWebColor}`,
  )

  const baseApiEnv = envFrom(oldApi)
  const baseWebEnv = envFrom(oldWeb)
  const baseZeroEnv = envFrom(cfg.zero)
  const serviceEnvValue = buildSharedServiceEnv(cfg, baseApiEnv, newWeb)
  baseApiEnv.CONTEXTBASE_UPLOADS_INTERNAL_BASE_URL = `http://${newWeb}:4017/api/files`
  baseWebEnv.CONTEXTBASE_UPLOADS_INTERNAL_BASE_URL = `http://${newWeb}:4017/api/files`
  baseApiEnv.CONTEXTBASE_PUBLIC_ASSETS_BASE_URL = cfg.publicAssetsBaseUrl
  baseWebEnv.CONTEXTBASE_PUBLIC_ASSETS_BASE_URL = cfg.publicAssetsBaseUrl
  baseApiEnv.DATABASE_SEARCH_PATH = "public"
  baseWebEnv.DATABASE_SEARCH_PATH = "public"
  forcePublicDatabaseSearchPath(serviceEnvValue)

  const apiEnv = writeEnv(forcePublicDatabaseSearchPath(baseApiEnv), `${target}-api`)
  const webEnv = writeEnv(forcePublicDatabaseSearchPath(baseWebEnv), `${target}-web`)
  const zeroEnv = writeEnv(baseZeroEnv, `${target}-zero`)
  const serviceEnv = writeEnv(serviceEnvValue, `${target}-services`)

  try {
    oneShot({
      image,
      network: cfg.network,
      envFile: apiEnv,
      cmd: [
        "sh",
        "-c",
        "node scripts/verify-public-schema.mjs && node scripts/migrate.mjs && node scripts/verify-public-schema.mjs && node scripts/verify-zero-publication.mjs",
      ],
    })

    runContainer({
      name: newApi,
      image,
      network: cfg.network,
      envFile: apiEnv,
      cmd: ["node", "apps/api/dist/server.js"],
      volumes: [[cfg.uploadVolume, "/data/uploads"]],
      proxy: true,
    })
    const apiIp = inspectIp(newApi, cfg.network)
    if (!checkHealth(`http://${apiIp}:3017/healthz`, 60))
      throw new Error(`API health failed: ${newApi}`)

    runContainer({
      name: newWeb,
      image,
      network: cfg.network,
      envFile: webEnv,
      cmd: ["node", "apps/web/server.mjs"],
      volumes: [[cfg.uploadVolume, "/data/uploads"]],
      proxy: true,
    })
    const webIp = inspectIp(newWeb, cfg.network)
    if (!checkHealth(`http://${webIp}:4017/healthz`, 60))
      throw new Error(`Web health failed: ${newWeb}`)

    runContainer({
      name: cfg.auth,
      image,
      network: cfg.network,
      envFile: serviceEnv,
      cmd: ["node", "apps/auth/dist/server.js"],
      volumes: [[cfg.uploadVolume, "/data/uploads"]],
      proxy: true,
    })
    const authIp = inspectIp(cfg.auth, cfg.network)
    if (!checkHealth(`http://${authIp}:3317/healthz`, 60))
      throw new Error(`Auth health failed: ${cfg.auth}`)

    runContainer({
      name: cfg.mcp,
      image,
      network: cfg.network,
      envFile: serviceEnv,
      cmd: ["node", "apps/mcp/dist/server.js"],
      volumes: [[cfg.uploadVolume, "/data/uploads"]],
      proxy: true,
    })
    const mcpIp = inspectIp(cfg.mcp, cfg.network)
    if (!checkHealth(`http://${mcpIp}:3217/healthz`, 60))
      throw new Error(`MCP health failed: ${cfg.mcp}`)

    const previous = patchFragments(cfg.fragments, [
      [oldApi, newApi],
      [oldWeb, newWeb],
    ])
    try {
      writeCaddySite(cfg.authFragment, new URL(cfg.authBaseUrl).hostname, `${cfg.auth}:3317`)
      writeCaddySite(cfg.mcpFragment, new URL(cfg.mcpBaseUrl).hostname, `${cfg.mcp}:3217`)
      reloadCaddySafe()
      sleep(8000)
      if (!checkHealth(cfg.publicHealth, 60))
        throw new Error(`Public health failed: ${cfg.publicHealth}`)
      if (!checkHealth(`${cfg.authBaseUrl}/healthz`, 60))
        throw new Error(`Public auth health failed: ${cfg.authBaseUrl}/healthz`)
      if (!checkHealth(`${cfg.mcpBaseUrl}/healthz`, 60))
        throw new Error(`Public MCP health failed: ${cfg.mcpBaseUrl}/healthz`)
    } catch (error) {
      restore(previous)
      reloadCaddySafe()
      throw error
    }

    rm(cfg.zero)
    runContainer({
      name: cfg.zero,
      image,
      network: cfg.network,
      envFile: zeroEnv,
      cmd: ["pnpm", "--filter", "@contextbase/web", "exec", "zero-cache"],
      volumes: [[cfg.zeroVolume, "/data"]],
      proxy: true,
    })

    if (oldWeb && oldWeb !== newWeb) rm(oldWeb)
    if (oldApi && oldApi !== newApi) rm(oldApi)
    writeReceipt(target, {
      deployed_at: new Date().toISOString(),
      target,
      sha,
      image,
      api_color: candidateApiColor,
      previous_api_color: liveApiColor,
      web_color: candidateWebColor,
      previous_web_color: liveWebColor,
      api: newApi,
      web: newWeb,
      auth: cfg.auth,
      mcp: cfg.mcp,
      zero: cfg.zero,
    })
    console.error(`# deployed ${target}: ${image}`)
  } finally {
    fs.rmSync(apiEnv, { force: true })
    fs.rmSync(webEnv, { force: true })
    fs.rmSync(zeroEnv, { force: true })
    fs.rmSync(serviceEnv, { force: true })
  }
}

const targets = process.argv.slice(2)
if (!targets.length) throw new Error("Usage: deploy-webstack.mjs <staging|prod> [...]")
for (const target of targets) await deploy(target)

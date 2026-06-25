import { spawnSync } from "node:child_process"

const mode = process.argv[2] ?? "up"
const slot = process.argv[3] ?? "2"

const slotConfig = {
  1: {
    apiHostPort: "3117",
    authHostPort: "3417",
    caddyPort: "8117",
    host: "contextbase-1.test",
    mcpHostPort: "3517",
    postgresHostPort: "5517",
    project: "contextbase-1",
    webHostPort: "4117",
    zeroHostPort: "4917",
  },
  2: {
    apiHostPort: "3017",
    authHostPort: "3317",
    caddyPort: "8217",
    host: "contextbase-2.test",
    mcpHostPort: "3217",
    postgresHostPort: "5417",
    project: "contextbase-2",
    webHostPort: "4017",
    zeroHostPort: "4817",
  },
}

const config = slotConfig[slot]
if (!config) {
  console.error("Usage: node scripts/local-domains-docker.mjs [up|down] [1|2]")
  process.exit(2)
}

const env = {
  ...process.env,
  API_HOST_PORT: config.apiHostPort,
  AUTH_HOST_PORT: config.authHostPort,
  CONTEXTBASE_API_RESOURCE_URL: `https://api.${config.host}/api/v1`,
  CONTEXTBASE_PUBLIC_ASSETS_BASE_URL: `https://${config.host}/public`,
  CONTEXTBASE_UPLOADS_PUBLIC_BASE_URL: `https://uploads.${config.host}`,
  LOCAL_API_BASE_URL: `https://api.${config.host}`,
  LOCAL_API_HOST: `api.${config.host}`,
  LOCAL_API_RESOURCE_URL: `https://api.${config.host}/api/v1`,
  LOCAL_APP_BASE_URL: `https://${config.host}`,
  LOCAL_APP_HOST: config.host,
  LOCAL_AUTH_BASE_URL: `https://${config.host}`,
  LOCAL_AUTH_COOKIE_DOMAIN: `.${config.host}`,
  LOCAL_CONSOLE_HOST: `console.${config.host}`,
  LOCAL_DOMAINS_CADDY_PORT: config.caddyPort,
  LOCAL_MCP_BASE_URL: `https://${config.host}`,
  LOCAL_PUBLIC_ASSETS_BASE_URL: `https://${config.host}/public`,
  LOCAL_UPLOADS_BASE_URL: `https://uploads.${config.host}`,
  LOCAL_UPLOADS_HOST: `uploads.${config.host}`,
  LOCAL_WEB_ALLOWED_HOSTS: `${config.host},uploads.${config.host}`,
  LOCAL_ZERO_BASE_URL: `https://zero.${config.host}`,
  LOCAL_ZERO_HOST: `zero.${config.host}`,
  MCP_HOST_PORT: config.mcpHostPort,
  POSTGRES_HOST_PORT: config.postgresHostPort,
  WEB_HOST_PORT: config.webHostPort,
  ZERO_HOST_PORT: config.zeroHostPort,
}

const composePrefix = [
  "compose",
  "-p",
  config.project,
  "-f",
  "docker-compose.yml",
  "-f",
  "docker-compose.local-domains.yml",
]

if (mode === "down") {
  run("docker", [...composePrefix, "down"])
} else if (mode === "up") {
  run("docker", [...composePrefix, "up", "-d", "--build", "postgres"])
  run("docker", [...composePrefix, "run", "--rm", "--build", "migrate"])
  run("node", ["scripts/verify-zero-publication.mjs"], {
    DATABASE_URL: `postgres://contextbase:contextbase_dev_only@127.0.0.1:${config.postgresHostPort}/contextbase`,
  })
  run("docker", [...composePrefix, "up", "-d", "--build", "api", "web", "auth", "mcp"])
  run("docker", [...composePrefix, "up", "-d", "--build", "--force-recreate", "zero-cache"])
  run("docker", [...composePrefix, "up", "-d", "--build", "caddy-local"])
} else {
  console.error("Usage: node scripts/local-domains-docker.mjs [up|down] [1|2]")
  process.exit(2)
}

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    env: { ...env, ...extraEnv },
    stdio: "inherit",
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

import { spawnSync } from "node:child_process"

const aliases = [
  process.env.LOCAL_APP_HOST ?? "contextbase-2.test",
  process.env.LOCAL_API_HOST ?? "api.contextbase-2.test",
  process.env.LOCAL_UPLOADS_HOST ?? "uploads.contextbase-2.test",
  process.env.LOCAL_ZERO_HOST ?? "zero.contextbase-2.test",
  process.env.LOCAL_CONSOLE_HOST ?? "console.contextbase-2.test",
]

const mode = process.argv[2] ?? "up"
const caddyPort = process.env.LOCAL_DOMAINS_CADDY_PORT ?? "8317"
const portlessPort = process.env.PORTLESS_PORT ?? "443"

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function getPortlessList() {
  return spawnSync("portless", ["list"], { encoding: "utf8" })
}

function activeProxyPort(output) {
  const match = output.match(/https:\/\/\S+?(?::(?<port>\d+))?\s+->/)
  if (!match) return undefined

  return match.groups?.port ?? "443"
}

function restartProxyIfWrongPort() {
  const list = getPortlessList()
  if (list.status !== 0) return

  const activePort = activeProxyPort(list.stdout)
  if (!activePort || activePort === portlessPort) return

  run("portless", ["proxy", "stop"])
}

function requirePortless() {
  const result = spawnSync("portless", ["--version"], { stdio: "ignore" })
  if (result.status === 0) return

  console.error("portless is not installed. Install it with: npm install -g portless")
  process.exit(1)
}

requirePortless()

if (mode === "up") {
  restartProxyIfWrongPort()
  run("portless", ["proxy", "start", "--port", portlessPort])
  for (const alias of aliases) {
    run("portless", ["alias", alias, caddyPort, "--force"])
  }
  run("portless", ["list"])
} else if (mode === "down") {
  for (const alias of aliases) {
    run("portless", ["alias", "--remove", alias])
  }
  run("portless", ["list"])
} else {
  console.error("Usage: node scripts/local-domains-portless.mjs [up|down]")
  process.exit(2)
}

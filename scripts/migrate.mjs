import "dotenv/config"

import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  log("error", "migration_config_missing", { variable: "DATABASE_URL" })
  process.exit(1)
}

const client = postgres(databaseUrl, {
  max: 1,
})

try {
  log("info", "migration_start", {})
  await client`select set_config('search_path', 'public', false)`
  const [schemaRow] = await client`select current_schema()`
  if (schemaRow?.current_schema !== "public") {
    throw new Error(
      `Migration search_path must resolve to public, got ${schemaRow?.current_schema}`,
    )
  }
  const db = drizzle(client)

  await migrate(db, {
    migrationsFolder: "drizzle",
  })

  log("info", "migration_success", {})
} catch (error) {
  log("error", "migration_failure", {
    error: error instanceof Error ? error.message : String(error),
  })
  throw error
} finally {
  await client.end()
}

function log(level, event, fields) {
  const output = JSON.stringify({
    event,
    level,
    ...fields,
  })
  if (level === "error") {
    console.error(output)
  } else {
    console.log(output)
  }
}

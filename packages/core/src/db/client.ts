import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

export type DbClient = ReturnType<typeof createDbClient>
export type Db = DbClient["db"]
export type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0]
export type DbOrTransaction = Db | DbTransaction

const runtimeSearchPath = process.env.DATABASE_SEARCH_PATH ?? "public"

export function createDbClient(databaseUrl = process.env.DATABASE_URL ?? "") {
  const client = postgres(databaseUrl, {
    connection: {
      options: `-c search_path=${runtimeSearchPath}`,
    },
    max: 10,
  })

  return {
    db: drizzle(client, { schema }),
    end: () => client.end(),
  }
}

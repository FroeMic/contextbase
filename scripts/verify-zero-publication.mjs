import fs from "node:fs"
import path from "node:path"
import postgres from "postgres"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error("DATABASE_URL is required")
  process.exit(1)
}

const publicationName = process.env.ZERO_PUBLICATION_NAME ?? "_contextbase_public_0"
const schemaName = process.env.ZERO_PUBLIC_SCHEMA ?? "public"
const configPath = path.resolve("packages/zero-schema/drizzle-zero.config.ts")

const config = fs.readFileSync(configPath, "utf8")
const tablesBlock = config.match(/tables:\s*{([\s\S]*?)\n\s*},\n}\)/)?.[1]

if (!tablesBlock) {
  console.error(`Could not locate Zero tables block in ${configPath}`)
  process.exit(1)
}

const tableKeys = [...tablesBlock.matchAll(/^\s{4}([A-Za-z][A-Za-z0-9]*):/gm)].map(
  (match) => match[1],
)

if (tableKeys.length === 0) {
  console.error(`No Zero tables found in ${configPath}`)
  process.exit(1)
}

const toSnakeCase = (value) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase()

const expectedTables = [...new Set(tableKeys.map(toSnakeCase))].sort()
const sql = postgres(databaseUrl, { max: 1 })

const quoteIdentifier = (value) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`)
  }
  return `"${value.replaceAll('"', '""')}"`
}

try {
  const publicationRows = await sql`
    select 1
    from pg_catalog.pg_publication
    where pubname = ${publicationName}
    limit 1
  `

  if (publicationRows.length === 0) {
    await sql.unsafe(`CREATE PUBLICATION ${quoteIdentifier(publicationName)}`)
  }

  const nonPublicPublicationTables = await sql`
    with expected(table_name) as (
      select * from unnest(${expectedTables}::text[])
    ), publication_tables as (
      select schemaname as schema_name, tablename as table_name
      from pg_catalog.pg_publication_tables
      where pubname = ${publicationName}
    )
    select publication_tables.schema_name, publication_tables.table_name
    from expected
    inner join publication_tables using (table_name)
    where publication_tables.schema_name <> ${schemaName}
    order by publication_tables.schema_name, publication_tables.table_name
  `

  if (nonPublicPublicationTables.length > 0) {
    console.error(
      JSON.stringify(
        {
          event: "non_public_publication_tables",
          publicationName,
          schemaName,
          tables: nonPublicPublicationTables,
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  const repairRows = await sql`
    with expected(table_name) as (
      select * from unnest(${expectedTables}::text[])
    ), public_tables as (
      select tablename as table_name
      from pg_catalog.pg_tables
      where schemaname = ${schemaName}
    ), publication_tables as (
      select tablename as table_name
      from pg_catalog.pg_publication_tables
      where pubname = ${publicationName}
        and schemaname = ${schemaName}
    )
    select expected.table_name
    from expected
    inner join public_tables using (table_name)
    left join publication_tables using (table_name)
    where publication_tables.table_name is null
    order by expected.table_name
  `

  for (const row of repairRows) {
    await sql.unsafe(
      `ALTER PUBLICATION ${quoteIdentifier(publicationName)} ADD TABLE ${quoteIdentifier(
        schemaName,
      )}.${quoteIdentifier(row.table_name)}`,
    )
  }

  const rows = await sql`
    with expected(table_name) as (
      select * from unnest(${expectedTables}::text[])
    ), public_tables as (
      select tablename as table_name
      from pg_catalog.pg_tables
      where schemaname = ${schemaName}
    ), publication_tables as (
      select tablename as table_name
      from pg_catalog.pg_publication_tables
      where pubname = ${publicationName}
        and schemaname = ${schemaName}
    )
    select
      expected.table_name,
      public_tables.table_name is not null as exists_in_public_schema,
      publication_tables.table_name is not null as exists_in_publication
    from expected
    left join public_tables using (table_name)
    left join publication_tables using (table_name)
    where public_tables.table_name is null
       or publication_tables.table_name is null
    order by expected.table_name
  `

  if (rows.length > 0) {
    console.error(
      JSON.stringify(
        {
          event: "zero_publication_verify_failed",
          publicationName,
          schemaName,
          missing: rows,
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  console.log(
    JSON.stringify({
      event: "zero_publication_verify_success",
      publicationName,
      publishedSchema: schemaName,
      schemaName,
      tableCount: expectedTables.length,
    }),
  )
} finally {
  await sql.end()
}

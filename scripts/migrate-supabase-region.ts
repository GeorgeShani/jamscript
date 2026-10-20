import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";

// Default: inspect only. --apply copies into an empty destination. --verify compares.
// bun --env-file=.env --env-file=.env.local scripts/migrate-supabase-region.ts --apply
const tables = [
  "workspaces",
  "workspace_members",
  "documents",
  "workspace_invitations",
  "document_revisions",
] as const;
const allTables = [...tables.map((name) => `jamscript.${name}`), "drizzle.__drizzle_migrations"];
const options = {
  max: 1,
  prepare: false,
  fetch_types: false,
  connect_timeout: 8,
  ssl: {
    rejectUnauthorized: true,
    ca: await readFile(new URL("./certs/supabase-prod-ca-2021.crt", import.meta.url), "utf8"),
  },
};
const sourceUrl = process.env["DATABASE_URL_OLD"];
const destinationUrl = process.env["DATABASE_URL"];
if (!sourceUrl || !destinationUrl)
  throw new Error("DATABASE_URL_OLD and DATABASE_URL are required");

function project(url: string) {
  const parsed = new URL(url);
  return parsed.hostname.endsWith(".pooler.supabase.com")
    ? decodeURIComponent(parsed.username).split(".")[1]
    : parsed.hostname.match(/^db\.([^.]+)\.supabase\.co$/)?.[1];
}
if (
  !project(sourceUrl) ||
  !project(destinationUrl) ||
  project(sourceUrl) === project(destinationUrl)
)
  throw new Error("Source and destination must be different Supabase projects");
for (const [url, key] of [
  [sourceUrl, "VITE_SUPABASE_URL_OLD"],
  [destinationUrl, "VITE_SUPABASE_URL"],
]) {
  const apiUrl = process.env[key!];
  if (!apiUrl || new URL(apiUrl).hostname.split(".")[0] !== project(url!))
    throw new Error("Database and API project credentials do not match");
}

type Snapshot = Record<string, Record<string, unknown>[]>;
const source = postgres(sourceUrl, options);
const destination = postgres(destinationUrl, options);
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function snapshot(client: postgres.Sql): Promise<Snapshot> {
  return client.begin("isolation level repeatable read read only", async (sql) => {
    await sql`set local timezone = 'UTC'`;
    const result: Snapshot = {};
    for (const table of allTables) {
      const [data] = await sql<{ rows: Record<string, unknown>[] }[]>`
        select coalesce(jsonb_agg(to_jsonb(t) order by t::text), '[]'::jsonb) as rows
        from ${sql(table)} t`;
      result[table] = data!.rows;
    }
    return result;
  });
}

async function layout(sql: postgres.Sql) {
  return {
    columns: await sql`select table_name,column_name,data_type,udt_name,is_nullable,column_default
      from information_schema.columns where table_schema='jamscript' order by table_name,ordinal_position`,
    constraints:
      await sql`select c.relname as table_name,con.conname,pg_get_constraintdef(con.oid) as definition
      from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='jamscript' order by c.relname,con.conname`,
    indexes: await sql`select tablename,indexname,indexdef from pg_indexes
      where schemaname='jamscript' order by tablename,indexname`,
    security: await sql`select c.relname,r.rolname as owner,c.relrowsecurity,c.relforcerowsecurity
      from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_roles r on r.oid=c.relowner
      where n.nspname='jamscript' and c.relkind='r' order by c.relname`,
    tableGrants: await sql`select table_name,grantor,grantee,privilege_type,is_grantable
      from information_schema.table_privileges where table_schema='jamscript'
      order by table_name,grantor,grantee,privilege_type`,
    schemaGrants:
      await sql`select coalesce(r.rolname,'PUBLIC') as grantee,a.privilege_type,a.is_grantable
      from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
      left join pg_roles r on r.oid=a.grantee where n.nspname='jamscript'
      order by grantee,a.privilege_type`,
  };
}

async function customTables(sql: postgres.Sql) {
  return sql<{ table_schema: string; table_name: string }[]>`
    select table_schema,table_name from information_schema.tables where table_type='BASE TABLE'
    and table_schema not in ('pg_catalog','information_schema','auth','storage','realtime','vault','net',
      'extensions','graphql','graphql_public','supabase_functions','pgsodium','pgsodium_masks','pgbouncer')
    order by table_schema,table_name`;
}

async function managedData(sql: postgres.Sql) {
  const [counts] = await sql`select (select count(*) from auth.users)::int as users,
    (select count(*) from storage.objects)::int as objects, (select count(*) from storage.buckets)::int as buckets,
    (select count(*) from vault.secrets)::int as vault`;
  return Object.values(counts!).some((count) => count !== 0);
}

async function assertPrivate(sql: postgres.Sql) {
  const grants = await sql`select r.rolname,c.relname from pg_roles r cross join pg_class c
    join pg_namespace n on n.oid=c.relnamespace where r.rolname in ('anon','authenticated')
    and n.nspname='jamscript' and c.relkind='r' and
      (has_schema_privilege(r.rolname,n.oid,'USAGE') or has_table_privilege(r.rolname,c.oid,'SELECT,INSERT,UPDATE,DELETE'))`;
  if (grants.length) throw new Error("Private application data has public API role grants");
}

let migrationDirectory: string | undefined;
try {
  if (await managedData(source))
    throw new Error("Auth, Storage or Vault data requires a full Supabase migration");
  const inventory = (await customTables(source)).map(
    (table) => `${table.table_schema}.${table.table_name}`,
  );
  if (digest(inventory.slice().sort()) !== digest(allTables.slice().sort()))
    throw new Error("Unexpected source tables require a full schema migration");
  const [custom] = await source`select
    (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='jamscript' and not t.tgisinternal)::int as triggers,
    (select count(*) from pg_policies where schemaname='jamscript')::int as policies`;
  if (custom!.triggers || custom!.policies)
    throw new Error("Custom triggers or policies require manual migration");
  await assertPrivate(source);
  const captured = await snapshot(source);
  const sourceLayout = await layout(source);
  console.log(
    JSON.stringify({
      phase: "source snapshot",
      rows: Object.fromEntries(allTables.map((table) => [table, captured[table]!.length])),
    }),
  );

  // The original migrations were applied with LF endings. Keep their exact hashes
  // and journal timestamps without changing the repository's Windows checkout.
  migrationDirectory = await mkdtemp(join(tmpdir(), "jamscript-region-schema-"));
  await mkdir(join(migrationDirectory, "meta"));
  const journalText = await readFile("drizzle/meta/_journal.json", "utf8");
  const journal = JSON.parse(journalText) as { entries: { tag: string }[] };
  await writeFile(join(migrationDirectory, "meta", "_journal.json"), journalText);
  for (const entry of journal.entries)
    await writeFile(
      join(migrationDirectory, `${entry.tag}.sql`),
      (await readFile(`drizzle/${entry.tag}.sql`, "utf8")).replace(/\r\n/g, "\n"),
    );
  const migrations = readMigrationFiles({ migrationsFolder: migrationDirectory });
  const history = captured["drizzle.__drizzle_migrations"]!;
  if (
    history.length !== migrations.length ||
    migrations.some(
      (migration, index) =>
        history[index]?.hash !== migration.hash ||
        Number(history[index]?.created_at) !== migration.folderMillis ||
        history[index]?.id !== index + 1,
    )
  )
    throw new Error("Source migration history does not match the checked-in schema");

  const existing = await customTables(destination);
  if (process.argv.includes("--verify")) {
    if (digest(sourceLayout) !== digest(await layout(destination)))
      throw new Error("Destination schema differs");
    if (digest(captured) !== digest(await snapshot(destination)))
      throw new Error("Destination data differs");
    await assertPrivate(destination);
    console.log(
      "VERIFIED: all rows, migration history, timestamps, constraints, indexes and private access match",
    );
  } else if (!process.argv.includes("--apply")) {
    console.log(
      JSON.stringify({
        phase: "preflight",
        destinationEmpty: existing.length === 0,
        sourceUntouched: true,
      }),
    );
  } else {
    if (existing.length || (await managedData(destination)))
      throw new Error("Destination is not empty; no data will be overwritten");
    await migrate(drizzle(destination), { migrationsFolder: migrationDirectory });
    if (digest(sourceLayout) !== digest(await layout(destination)))
      throw new Error("Migrated schema differs from source; data import refused");
    await assertPrivate(destination);
    await destination.begin(async (sql) => {
      await sql`set local timezone = 'UTC'`;
      for (const table of tables) {
        const qualified = `jamscript.${table}`;
        await sql`lock table ${sql(qualified)} in exclusive mode`;
        const [count] = await sql`select count(*)::int as count from ${sql(qualified)}`;
        if (count!.count)
          throw new Error("Destination received data during migration; import refused");
        const rows = captured[qualified]!;
        if (rows.length)
          await sql`insert into ${sql(qualified)} select * from json_populate_recordset(null::${sql(qualified)}, ${JSON.stringify(rows)}::json)`;
        const [copied] = await sql<{ rows: Record<string, unknown>[] }[]>`
          select coalesce(jsonb_agg(to_jsonb(t) order by t::text), '[]'::jsonb) as rows from ${sql(qualified)} t`;
        if (digest(rows) !== digest(copied!.rows))
          throw new Error("Copied data failed integrity verification");
      }
      if (digest(captured) !== digest(await snapshot(source)))
        throw new Error("Source changed during migration; data import rolled back");
    });
    if (digest(captured) !== digest(await snapshot(destination)))
      throw new Error("Post-commit integrity verification failed");
    await assertPrivate(destination);
    console.log(
      "MIGRATED AND VERIFIED: application data and migration history match; source database unchanged",
    );
  }
} catch (cause) {
  // Driver errors can include SQL, credentials or row contents. Never print them.
  console.error(
    "Migration failed:",
    cause instanceof Error && cause.constructor === Error
      ? cause.message
      : "Database operation failed; inspect connection settings and schema",
  );
  process.exitCode = 1;
} finally {
  await Promise.allSettled([source.end({ timeout: 1 }), destination.end({ timeout: 1 })]);
  if (
    migrationDirectory &&
    resolve(migrationDirectory).startsWith(resolve(tmpdir()) + sep) &&
    migrationDirectory.includes("jamscript-region-schema-")
  )
    await rm(migrationDirectory, { recursive: true, force: true });
}

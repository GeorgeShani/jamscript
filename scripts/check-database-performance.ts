import postgres from "postgres";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  listVisibleDocuments,
  listWorkspaceMembers,
} from "../src/features/collaboration/membership";

// Read-only diagnostic. Prints timings and counts, never URLs, identities or source.
// bun --env-file=.env --env-file=.env.local scripts/check-database-performance.ts
const url = process.env["DATABASE_URL"];
if (!url) throw new Error("Set the server-only DATABASE_URL before running this diagnostic");
const client = postgres(url, { max: 1, prepare: false, connect_timeout: 8, fetch_types: false });
const db = drizzle(client);
const elapsed = (start: number) => Math.round(performance.now() - start);
try {
  let start = performance.now();
  await client`select 1`;
  console.log(JSON.stringify({ phase: "connect + first query", ms: elapsed(start) }));
  for (let index = 0; index < 3; index++) {
    start = performance.now();
    await client`select 1`;
    console.log(JSON.stringify({ phase: "warm network round trip", ms: elapsed(start) }));
  }
  await db.transaction(
    async (scopedDb) => {
      const [member] = await scopedDb.execute<{ clerk_user_id: string; workspace_id: string }>(sql`
      select clerk_user_id, workspace_id from jamscript.workspace_members limit 1`);
      if (!member) {
        console.log("No memberships available to measure");
        return;
      }
      start = performance.now();
      const files = await listVisibleDocuments(scopedDb, member.clerk_user_id);
      console.log(
        JSON.stringify({ phase: "workspace list", ms: elapsed(start), rows: files.length }),
      );
      start = performance.now();
      const people = await listWorkspaceMembers(
        scopedDb,
        member.workspace_id,
        member.clerk_user_id,
      );
      console.log(
        JSON.stringify({ phase: "workspace members", ms: elapsed(start), rows: people.length }),
      );
      const [plan] = await scopedDb.execute(sql`explain (analyze, buffers, format json)
      select d.id, d.name, w.name, m.role from jamscript.workspace_members m
      join jamscript.workspaces w on w.id=m.workspace_id
      join jamscript.documents d on d.workspace_id=w.id
      where m.clerk_user_id=${member.clerk_user_id}`);
      const timings = plan!["QUERY PLAN"][0];
      console.log(
        JSON.stringify({
          phase: "Postgres list execution",
          planningMs: timings["Planning Time"],
          executionMs: timings["Execution Time"],
        }),
      );
    },
    { accessMode: "read only" },
  );
} catch (cause) {
  console.error("Database probe failed", cause instanceof Error ? cause.name : "Unknown error");
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 1 });
}

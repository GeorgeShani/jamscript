import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { CollaborationDb } from "./membership";

export async function withCollaborationDb<T>(run: (db: CollaborationDb) => Promise<T>) {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("Shared workspaces are not configured");
  const client = postgres(url, { max: 1, prepare: false });
  try {
    return await run(drizzle(client));
  } finally {
    await client.end();
  }
}

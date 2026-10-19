import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { CollaborationDb } from "./membership";

export async function withCollaborationDb<T>(run: (db: CollaborationDb) => Promise<T>) {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("Shared workspaces are not configured");
  // Workers own sockets per request. Bound connection/shutdown waits rather
  // than leaving the workspace loader waiting for the driver's long defaults.
  const client = postgres(url, {
    max: 1,
    prepare: false,
    connect_timeout: 8,
  });
  try {
    return await run(drizzle(client));
  } finally {
    await client.end({ timeout: 1 });
  }
}

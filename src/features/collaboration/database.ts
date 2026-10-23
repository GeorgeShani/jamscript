import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { CollaborationDb } from "./membership";

async function databaseConnection() {
  // Hyperdrive pools the long-distance DB connection while sockets remain scoped
  // to this Worker request. HYPERDRIVE_FRESH must have query caching disabled:
  // membership revocation and read-after-write must reach Postgres immediately.
  try {
    const { env } = await import("cloudflare:workers");
    if (env.HYPERDRIVE_FRESH?.connectionString)
      return { url: env.HYPERDRIVE_FRESH.connectionString, prepare: true };
  } catch {
    // CLI diagnostics/tests run outside the Workers runtime.
  }
  return { url: process.env["DATABASE_URL"], prepare: false };
}

export async function withCollaborationDb<T>(run: (db: CollaborationDb) => Promise<T>) {
  const { url, prepare } = await databaseConnection();
  if (!url) throw new Error("Shared workspaces are not configured");
  // Workers own sockets per request. Bound connection/shutdown waits rather
  // than leaving the workspace loader waiting for the driver's long defaults.
  const client = postgres(url, {
    max: 1,
    prepare,
    // This schema uses no PostgreSQL array columns; avoid a type-catalog query
    // on every new connection. Hyperdrive and Supavisor need different prepare modes.
    fetch_types: false,
    connect_timeout: 8,
  });
  try {
    return await run(drizzle(client));
  } finally {
    // Closing the socket is not part of the answer; let the Worker finish it after the
    // response instead of making the caller wait for the shutdown round trip.
    const closing = client.end({ timeout: 1 }).catch(() => {});
    try {
      const { waitUntil } = await import("cloudflare:workers");
      waitUntil(closing);
    } catch {
      // CLI diagnostics and tests run outside the Workers runtime.
      await closing;
    }
  }
}

import { Pool as NeonPool, neonConfig, neon } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const databaseUrl = process.env.DATABASE_URL.trim();
const host = databaseUrl.includes("@")
  ? databaseUrl.split("@")[1]?.split("/")[0]?.split(":")[0] || ""
  : "localhost";
const isLocalDb = host === "localhost" || host === "127.0.0.1";

let pool: PgPool | NeonPool;
let db: ReturnType<typeof drizzlePg> | ReturnType<typeof drizzleNeon>;

if (isLocalDb) {
  pool = new PgPool({ connectionString: databaseUrl });
  db = drizzlePg(pool, { schema });
} else {
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString: databaseUrl });
  db = drizzleNeon({ client: pool, schema });
}

// HTTP-based Neon client — use for one-off queries in serverless contexts
// where the WebSocket pool can stall (e.g. INSERT in cold-start functions)
export const neonHttp = isLocalDb ? null : neon(databaseUrl);

export { pool, db };

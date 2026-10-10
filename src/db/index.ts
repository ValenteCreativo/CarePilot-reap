import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type DatabaseClient = NeonHttpDatabase<typeof schema>;

const connectionString = process.env.DATABASE_URL;
const missingConnectionError = () => new Error("DATABASE_URL environment variable is not set");

const dbClient: DatabaseClient =
  connectionString && connectionString.length > 0
    ? drizzle(neon(connectionString), { schema })
    : (new Proxy(
        {},
        {
          get() {
            throw missingConnectionError();
          },
        }
      ) as DatabaseClient);

export const db = dbClient;

export * from "./schema";

import { neon } from "@neondatabase/serverless";
import { ensureDirectDatabaseUrl } from "@/lib/db-url";

// The Neon serverless driver uses HTTP (Neon-specific endpoint).
// It must receive a plain postgres:// URL — never the Accelerate URL.
export const getSql = () => {
  const databaseUrl = ensureDirectDatabaseUrl();
  return neon(databaseUrl);
};

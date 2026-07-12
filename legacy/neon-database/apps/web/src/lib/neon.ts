import { neon } from "@neondatabase/serverless";

// Retired helper preserved only for database rollback analysis.
export const getLegacyNeonSql = (databaseUrl: string) => neon(databaseUrl);

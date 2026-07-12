export function isCloudflareRuntime() {
  // Kept only for local comparison with legacy SQL paths during migration.
  // Vercel and production must always use the standard Prisma/PostgreSQL path.
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.POSTGRES_COMPAT_RUNTIME === "1"
  );
}

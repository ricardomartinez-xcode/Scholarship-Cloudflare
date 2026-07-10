type EnvSource = Record<string, string | undefined>;

type ParseOptions = {
  nodeEnv?: string;
};

export type ClientEnv = {
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export type ServerEnv = ClientEnv & {
  databaseUrl: string;
  directUrl: string;
  supabaseServiceRoleKey: string | null;
};

function readTrimmed(env: EnvSource, name: string) {
  const value = env[name]?.trim();
  return value ? value : null;
}

function requireUrl(value: string, name: string) {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
}

function missingMessage(scope: "public" | "server", names: string[]) {
  return `Missing required ${scope} environment variables: ${names.join(", ")}`;
}

function resolveSupabaseAnonKey(env: EnvSource) {
  return (
    readTrimmed(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
    readTrimmed(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  );
}

export function parseClientEnv(env: EnvSource, options: ParseOptions = {}): ClientEnv {
  const missing: string[] = [];
  const supabaseUrl = readTrimmed(env, "NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = resolveSupabaseAnonKey(env);
  const configuredAppUrl = readTrimmed(env, "NEXT_PUBLIC_APP_URL");
  const nodeEnv = options.nodeEnv ?? env.NODE_ENV ?? process.env.NODE_ENV;

  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!configuredAppUrl && nodeEnv === "production") missing.push("NEXT_PUBLIC_APP_URL");

  if (missing.length) {
    throw new Error(missingMessage("public", missing));
  }

  return {
    appUrl: requireUrl(configuredAppUrl ?? "http://127.0.0.1:3000", "NEXT_PUBLIC_APP_URL"),
    supabaseUrl: requireUrl(supabaseUrl as string, "NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: supabaseAnonKey as string,
  };
}

export function parseServerEnv(env: EnvSource, options: ParseOptions = {}): ServerEnv {
  const clientEnv = parseClientEnv(env, options);
  const databaseUrl = readTrimmed(env, "DATABASE_URL");
  const directUrl = readTrimmed(env, "DIRECT_URL");
  const missing: string[] = [];

  if (!databaseUrl) missing.push("DATABASE_URL");
  if (!directUrl) missing.push("DIRECT_URL");

  if (missing.length) {
    throw new Error(missingMessage("server", missing));
  }

  return {
    ...clientEnv,
    databaseUrl: databaseUrl as string,
    directUrl: directUrl as string,
    supabaseServiceRoleKey: readTrimmed(env, "SUPABASE_SERVICE_ROLE_KEY"),
  };
}

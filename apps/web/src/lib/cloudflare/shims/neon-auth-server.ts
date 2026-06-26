type AuthUser = {
  id: string;
  email: string;
  primaryEmail?: string;
};

type AuthResult<T = unknown> = Promise<{
  data: T | null;
  error: { message: string } | null;
}>;

const disabled = "Neon Auth was removed from the Cloudflare runtime.";

async function unauthenticated(): AuthResult<{ user: AuthUser }> {
  return { data: null, error: null };
}

async function unsupported(): AuthResult {
  return { data: null, error: { message: disabled } };
}

export function createNeonAuth() {
  return {
    getSession: unauthenticated,
    changePassword: unsupported,
    signOut: async () => ({ data: { ok: true }, error: null }),
    signIn: {
      email: unsupported,
    },
    signUp: {
      email: unsupported,
    },
    handler() {
      return {
        GET: async () => Response.json({ error: disabled }, { status: 410 }),
        POST: async () => Response.json({ error: disabled }, { status: 410 }),
      };
    },
    middleware() {
      return async () => undefined;
    },
  };
}

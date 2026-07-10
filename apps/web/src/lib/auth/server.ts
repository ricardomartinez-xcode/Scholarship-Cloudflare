import "server-only";

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type EmailPasswordInput = {
  email: string;
  password: string;
};

type EmailSignUpInput = EmailPasswordInput & {
  name?: string;
  callbackURL?: string;
};

type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions?: boolean;
};

function authError(message: string) {
  return { message };
}

export const auth = {
  async getSession() {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    return {
      data: data.user ? { user: data.user } : null,
      error,
    };
  },

  signIn: {
    async email(input: EmailPasswordInput) {
      const supabase = await createSupabaseServerClient();
      return supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
    },
  },

  signUp: {
    async email(input: EmailSignUpInput) {
      const supabase = await createSupabaseServerClient();
      return supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            name: input.name,
            display_name: input.name,
          },
          emailRedirectTo: input.callbackURL,
        },
      });
    },
  },

  async changePassword(input: ChangePasswordInput) {
    const supabase = await createSupabaseServerClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const email = userData.user?.email?.trim();
    if (userError || !email) {
      return { data: null, error: authError("Sesion expirada. Inicia sesion de nuevo.") };
    }

    const passwordCheck = await supabase.auth.signInWithPassword({
      email,
      password: input.currentPassword,
    });
    if (passwordCheck.error) {
      return { data: null, error: authError("La contrasena actual no es valida.") };
    }

    const result = await supabase.auth.updateUser({ password: input.newPassword });
    if (!result.error && input.revokeOtherSessions) {
      await supabase.auth.signOut({ scope: "others" }).catch(() => undefined);
    }
    return result;
  },

  async signOut() {
    const supabase = await createSupabaseServerClient();
    return supabase.auth.signOut();
  },

  handler() {
    return {
      GET(..._args: unknown[]) {
        return NextResponse.json(
          { ok: false, error: "Supabase Auth usa /auth/callback en esta migracion." },
          { status: 404 },
        );
      },
      POST(..._args: unknown[]) {
        return NextResponse.json(
          { ok: false, error: "Supabase Auth usa los endpoints dedicados de la app." },
          { status: 404 },
        );
      },
    };
  },
};

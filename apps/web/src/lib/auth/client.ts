"use client";

import "@/lib/crypto-random-uuid-polyfill";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SocialProvider = "google";

type SocialSignInInput = {
  provider: SocialProvider;
  callbackURL: string;
  newUserCallbackURL?: string;
  errorCallbackURL?: string;
};

type MagicLinkInput = {
  email: string;
  callbackURL: string;
  newUserCallbackURL?: string;
  errorCallbackURL?: string;
};

type EmailOtpInput = {
  email: string;
  otp: string;
  name?: string;
};

type SendEmailOtpInput = {
  email: string;
  type: "sign-in";
};

type PasswordResetInput = {
  email: string;
  redirectTo: string;
  fetchOptions?: { throw?: boolean };
};

type ResetPasswordInput = {
  newPassword: string;
  token?: string;
};

type PhoneOtpInput = {
  phoneNumber: string;
};

type PhoneVerifyInput = PhoneOtpInput & {
  code: string;
  updatePhoneNumber: boolean;
};

export const authClient = {
  signIn: {
    async social(input: SocialSignInInput) {
      const supabase = createSupabaseBrowserClient();
      return supabase.auth.signInWithOAuth({
        provider: input.provider,
        options: {
          redirectTo: input.callbackURL,
        },
      });
    },

    async magicLink(input: MagicLinkInput) {
      const supabase = createSupabaseBrowserClient();
      return supabase.auth.signInWithOtp({
        email: input.email,
        options: {
          emailRedirectTo: input.callbackURL,
          shouldCreateUser: true,
        },
      });
    },

    async emailOtp(input: EmailOtpInput) {
      const supabase = createSupabaseBrowserClient();
      return supabase.auth.verifyOtp({
        email: input.email,
        token: input.otp,
        type: "email",
        options: {
          data: input.name ? { name: input.name, display_name: input.name } : undefined,
        },
      });
    },
  },

  emailOtp: {
    async sendVerificationOtp(input: SendEmailOtpInput) {
      const supabase = createSupabaseBrowserClient();
      return supabase.auth.signInWithOtp({
        email: input.email,
        options: {
          shouldCreateUser: true,
        },
      });
    },
  },

  async requestPasswordReset(input: PasswordResetInput) {
    const supabase = createSupabaseBrowserClient();
    return supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo: input.redirectTo,
    });
  },

  async resetPassword(input: ResetPasswordInput) {
    const supabase = createSupabaseBrowserClient();
    return supabase.auth.updateUser({ password: input.newPassword });
  },

  phoneNumber: {
    async sendOtp(input: PhoneOtpInput) {
      const supabase = createSupabaseBrowserClient();
      return supabase.auth.updateUser({ phone: input.phoneNumber });
    },

    async verify(input: PhoneVerifyInput) {
      const supabase = createSupabaseBrowserClient();
      return supabase.auth.verifyOtp({
        phone: input.phoneNumber,
        token: input.code,
        type: input.updatePhoneNumber ? "phone_change" : "sms",
      });
    },
  },
};

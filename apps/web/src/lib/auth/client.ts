"use client";

import "@/lib/crypto-random-uuid-polyfill";

import { createAuthClient } from "@neondatabase/auth/next";
import { emailOTPClient, magicLinkClient, phoneNumberClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [magicLinkClient(), emailOTPClient(), phoneNumberClient()],
});

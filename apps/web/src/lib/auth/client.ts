"use client";

import "@/lib/crypto-random-uuid-polyfill";

import { createAuthClient } from "@neondatabase/auth/next";

export const authClient = createAuthClient();

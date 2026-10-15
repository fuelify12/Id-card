"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/env";

export function createClient() {
  const env = getSupabasePublicEnv();
  return createBrowserClient(env.url, env.publishableKey, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      maxAge: 400 * 24 * 60 * 60,
      secure: process.env.NODE_ENV === "production",
    },
  });
}

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/lib/env";

const authCookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: 400 * 24 * 60 * 60,
  secure: process.env.NODE_ENV === "production",
};

export async function createClient() {
  const env = getSupabasePublicEnv();
  const cookieStore = await cookies();
  return createServerClient(env.url, env.publishableKey, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, { ...authCookieOptions, ...options })
          );
        } catch {
          // Server Components cannot always mutate cookies; proxy refreshes sessions.
        }
      },
    },
  });
}

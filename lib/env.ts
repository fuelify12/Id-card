export type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
};

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error("Supabase URL and publishable key must be configured in the deployment environment.");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Supabase URL must be a valid absolute URL.");
  }

  const localHttpAllowed = process.env.NODE_ENV !== "production"
    && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && localHttpAllowed)) {
    throw new Error("Supabase must use HTTPS outside local development.");
  }

  // Modern publishable keys are preferred. For legacy JWT anon keys, inspect the role
  // claim rather than accepting any JWT (which could accidentally be a service-role key).
  const isLegacyAnonKey = (() => {
    const parts = publishableKey.split(".");
    if (parts.length !== 3 || !parts[0].startsWith("eyJ")) return false;
    try {
      let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      payload += "=".repeat((4 - (payload.length % 4)) % 4);
      return JSON.parse(atob(payload)).role === "anon";
    } catch {
      return false;
    }
  })();
  if (!publishableKey.startsWith("sb_publishable_") && !isLegacyAnonKey) {
    throw new Error("Supabase publishable key has an unsupported format.");
  }

  return { url: parsed.origin, publishableKey };
}

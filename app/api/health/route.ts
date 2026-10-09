import { NextResponse } from "next/server";
import { getSupabasePublicEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(status: "ok" | "not_ready", code: number) {
  return NextResponse.json(
    { status, timestamp: new Date().toISOString() },
    {
      status: code,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

/**
 * Minimal deployment readiness probe. Does not query the database, disclose
 * dependency details, or return environment values. A successful response
 * confirms required public Supabase configuration is syntactically valid;
 * it does NOT claim Supabase/database/storage availability.
 */
export async function GET() {
  try {
    getSupabasePublicEnv();
    return response("ok", 200);
  } catch {
    return response("not_ready", 503);
  }
}

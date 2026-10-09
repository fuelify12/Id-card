export type RateLimitAction =
  | "project_create"
  | "template_upload"
  | "student_import"
  | "photo_upload_ticket"
  | "photo_processing"
  | "batch_generate"
  | "zip_export";

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; unavailable: true }
  | { allowed: false; unavailable: false };

export async function consumeRateLimit(
  client: RpcClient,
  action: RateLimitAction,
  limit: number,
  windowSeconds = 60,
): Promise<RateLimitDecision> {
  try {
    const { data, error } = await client.rpc("consume_security_rate_limit", {
      p_action: action,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error || typeof data !== "boolean") return { allowed: false, unavailable: true };
    return data ? { allowed: true } : { allowed: false, unavailable: false };
  } catch {
    // Fail closed for resource-intensive operations when the shared limiter is unavailable.
    return { allowed: false, unavailable: true };
  }
}

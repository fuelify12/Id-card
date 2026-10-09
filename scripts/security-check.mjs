import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const violations = [];
const secretPatterns = [
  ["Supabase service-role secret assignment", /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["']?\S{20,}/i],
  ["service-role key exposed through NEXT_PUBLIC", /NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/i],
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["private key material", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["live Stripe secret", /\bsk_live_[0-9A-Za-z]{16,}\b/],
];

for (const path of tracked) {
  const normalized = path.replaceAll("\\", "/");
  if (/^(?:\.env|\.env\.[^/]+)$/.test(normalized) && normalized !== ".env.example") {
    violations.push({ path, reason: "tracked environment file; only sanitized .env.example may be tracked" });
    continue;
  }
  if ([".png", ".jpg", ".jpeg", ".webp", ".pdf", ".zip"].includes(extname(path).toLowerCase())) continue;
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  for (const [reason, pattern] of secretPatterns) {
    if (pattern.test(content)) violations.push({ path, reason });
  }
  if (normalized.includes("NEXT_PUBLIC_") && /NEXT_PUBLIC_(?:SUPABASE_)?(?:SERVICE_ROLE|SECRET|PRIVATE_KEY)/i.test(content)) {
    violations.push({ path, reason: "client-exposed privileged secret variable name" });
  }
}

if (violations.length) {
  for (const finding of violations) process.stderr.write(`SECURITY CHECK FAILED: ${finding.path}: ${finding.reason}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Secret hygiene check passed for ${tracked.length} tracked files (working tree only; not Git history).\n`);
}

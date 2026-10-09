import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const roots = [".next/static"];
const files = [];
function walk(path) {
  if (!existsSync(path)) return;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile()) files.push(full);
  }
}
for (const root of roots) walk(root);

if (files.length === 0) {
  process.stderr.write("Client bundle security check failed: .next/static contains no files.\n");
  process.exit(1);
}

const patterns = [
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{20,}/],
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["live Stripe secret", /\bsk_live_[0-9A-Za-z]{16,}\b/],
  ["private key material", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];
const findings = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const [name, pattern] of patterns) {
    if (pattern.test(text)) findings.push({ file: relative(".", file), name });
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (!value || value.length < 24 || !/(SERVICE_ROLE|SECRET|PRIVATE_KEY|GEMINI_API_KEY|DATABASE_URL)/i.test(key)) continue;
    if (text.includes(value)) findings.push({ file: relative(".", file), name: `server environment value from ${key}` });
  }
}

if (findings.length) {
  for (const finding of findings) process.stderr.write(`CLIENT BUNDLE SECURITY CHECK FAILED: ${finding.file}: ${finding.name}\n`);
  process.exit(1);
}
process.stdout.write(`Client bundle security check passed for ${files.length} generated static files.\n`);

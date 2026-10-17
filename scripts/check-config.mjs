import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function readEnv(name) {
  const text = fs.readFileSync(path.join(root, name), "utf8");
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((line) => /^\s*[A-Z_][A-Z_0-9]*\s*=/.test(line))
      .map((line) => {
        const at = line.indexOf("=");
        let value = line.slice(at + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        )
          value = value.slice(1, -1);
        return [line.slice(0, at).trim(), value];
      }),
  );
}
try {
  const env = readEnv(".env.local"),
    worker = readEnv(".env.worker"),
    issues = [];
  for (const name of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "WHATSAPP_WORKER_TOKEN",
    "WHATSAPP_WEBHOOK_SECRET",
  ]) {
    if (!env[name] || /YOUR_|REPLACE|<[^>]+>/i.test(env[name]))
      issues.push(name + " is missing or still a placeholder.");
  }
  if (env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
      if (!["https:", "http:"].includes(url.protocol)) throw Error();
    } catch {
      issues.push("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
    }
  }
  if (env.DEMO_MODE !== "false")
    issues.push("Set DEMO_MODE=false when ready to activate live mode.");
  if (env.APP_URL !== "http://localhost:3000")
    issues.push("For this local launch, set APP_URL=http://localhost:3000.");
  for (const name of ["WHATSAPP_WORKER_TOKEN", "WHATSAPP_WEBHOOK_SECRET"]) {
    if (!worker[name] || worker[name] !== env[name])
      issues.push(name + " must match in both env files.");
    else if (worker[name].length < 32) issues.push(name + " is too short.");
  }
  if (Buffer.from(worker.WHATSAPP_SESSION_KEY || "", "base64").length !== 32)
    issues.push("WHATSAPP_SESSION_KEY must decode to 32 bytes.");
  if (worker.WHATSAPP_WEBHOOK_URL !== "http://web:3000/api/webhooks/whatsapp")
    issues.push(
      "Set WHATSAPP_WEBHOOK_URL=http://web:3000/api/webhooks/whatsapp in .env.worker.",
    );
  if (issues.length) {
    console.log(
      "Not ready for live mode:\n" +
        issues.map((issue) => "• " + issue).join("\n"),
    );
    process.exitCode = 1;
  } else
    console.log(
      "Environment checks passed. No secret values were printed. Database migration and authentication still require a live test.",
    );
} catch {
  console.error(
    "Cannot read the local env files. Run node scripts/configure.mjs from the project folder first.",
  );
  process.exitCode = 1;
}

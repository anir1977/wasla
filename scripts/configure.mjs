// Local interactive setup. Secrets are entered in a local file, never sent to chat.
import fs from "node:fs";
import { randomBytes } from "node:crypto";
const env = ".env.local",
  worker = ".env.worker";
if (fs.existsSync(worker)) {
  console.log(
    ".env.worker already exists; existing encryption keys were preserved.",
  );
  process.exit(0);
}
const token = randomBytes(32).toString("hex"),
  secret = randomBytes(32).toString("hex"),
  key = randomBytes(32).toString("base64");
const existing = fs.existsSync(env)
  ? fs.readFileSync(env, "utf8")
  : fs.readFileSync(".env.example", "utf8");
let value = existing;
for (const [name, content] of Object.entries({
  WHATSAPP_WORKER_TOKEN: token,
  WHATSAPP_WEBHOOK_SECRET: secret,
  WHATSAPP_WORKER_URL: "http://127.0.0.1:8091",
})) {
  const expression = new RegExp("^" + name + "=.*$", "m");
  value = expression.test(value)
    ? value.replace(expression, name + "=" + content)
    : value + "\n" + name + "=" + content + "\n";
}
fs.writeFileSync(env, value, { mode: 0o600 });
fs.chmodSync(env, 0o600);
fs.writeFileSync(
  worker,
  `WHATSAPP_WORKER_TOKEN=${token}\nWHATSAPP_WEBHOOK_SECRET=${secret}\nWHATSAPP_SESSION_KEY=${key}\nWHATSAPP_WEBHOOK_URL=http://web:3000/api/webhooks/whatsapp\n`,
  { mode: 0o600 },
);
console.log(
  "Private env files created. Open .env.local in your editor to add Supabase and Gemini credentials. Secrets were not printed. Back up .env.worker securely.",
);

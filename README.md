# Wasla · Moroccan commerce SaaS MVP

Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS 4 · Supabase Auth/Postgres/Storage/Realtime · dedicated multi-store Baileys worker · Gemini through AI SDK.

## Open the local preview

**http://localhost:3000** — the running preview uses `DEMO_MODE=true`. Fictional orders and products are clearly labeled; edits are temporary in-memory changes, and no real login, WhatsApp pairing or AI calls happen in this mode. The existing n8n demo at localhost:8080 is a separate app and was not migrated or replaced.

```sh
cd /Users/yuba/Documents/ChatGPT/vizuads.maroc/wasla-saas
npm ci
npm run dev
```

Pages: `/`, `/login`, `/register`, `/settings`, `/products`, `/whatsapp`, `/orders`. UI language is French with Moroccan Darija copy. The logo field supports private image upload, product variants have independent stock, and order details show full delivery information. Products use a generic garment illustration, not product photography.

## Current local live setup

This checkout is now configured with `DEMO_MODE=false` and runs through Docker Compose on **http://localhost:3000**. The `wasla` Supabase project has been aligned using `20261016015455_align_live_schema.sql`; do not re-run the initial CREATE TABLE migration on that already-configured project. Existing empty bootstrap tables were altered in place and their extra legacy fields retained. The logo bucket was made private and its broad old storage policies replaced with tenant policies.

A first store-owner account must still be registered at `/register` and email-confirmed. Then add a product, enable the assistant, and pair `/whatsapp`. Credentials stay only in ignored local env files. The existing n8n demo is separate.

## Activate the real backend

1. Create a Supabase project. In **SQL Editor**, apply `supabase/migrations/20261016010513_initial_commerce.sql` once. It creates the tables, tenant RLS policies, private logo bucket, Realtime publication, and transactional RPCs. No remote project has been created or modified by this scaffold.
2. In Supabase **Auth → URL Configuration**, set Site URL to `http://localhost:3000` and allow redirect `http://localhost:3000/auth/confirm`. For an HTTPS deployment use its exact origin. Keep email confirmation enabled. If customizing the confirmation email, use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
3. Run `node scripts/configure.mjs` once. It generates shared worker/webhook secrets and an independent session encryption key in mode-0600 `.env.local` / `.env.worker`, without printing them. Existing worker keys are preserved. Keep a secure backup of the worker file; losing its encryption key requires re-pairing every store.
4. Open `.env.local` privately in your editor. Add:
   - `NEXT_PUBLIC_SUPABASE_URL`: project URL.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: public publishable key.
   - `SUPABASE_SECRET_KEY`: backend secret key (legacy service_role is also accepted by the SDK). Never use a `NEXT_PUBLIC_` prefix.
   - `GOOGLE_GENERATIVE_AI_API_KEY`: your Gemini key.
   - `GEMINI_MODEL=gemini-3.1-flash-lite`, configurable for the model enabled on your project.
   - `APP_URL=http://localhost:3000` and `DEMO_MODE=false`.
5. Stop the preview process on port 3000, then run:

```sh
docker compose --env-file .env.local up -d --build
```

The web and worker containers communicate over the private Docker network. Only localhost ports 3000 and 8091 are published. The worker API requires a server-only bearer token. Do not expose 8091 publicly. Public Supabase values are supplied at build time, so rebuild after changing projects.

6. Open `/register`, create an account, confirm the email, and log in. On the first authenticated dashboard visit a store is created, owned by the verified user. In `/settings`, add store details and fees, add products in `/products`, then scan the QR in `/whatsapp`. Enable **L’assistant peut répondre** only when ready to reply to real customers; it defaults to off.
7. From a **second WhatsApp account**, message the linked store account. The SaaS worker ignores outgoing/fromMe messages to avoid AI loops, so this flow is not the old demo’s self-chat test. Ask for a real in-stock item, provide name/city/address/size/color, receive the recap, and explicitly confirm (e.g. “oui je confirme” or “wakha”). Watch `/orders` and stock update.

Supabase sign-in/email rate limits and delivery depend on the project's Auth/SMTP configuration. Gemini quota depends on your Google project; a model change or new key does not guarantee free quota. No API keys are copied from your existing n8n setup.

## Data and request flow

```text
Owner browser → verified Supabase session → tenant-scoped API/RLS
WhatsApp customer → tenant's Baileys session → encrypted durable SQLite queue
  → HMAC(timestamp + raw body) → POST /api/webhooks/whatsapp
  → claim event → hourly usage guard → catalog + conversation → Gemini structured output
  → explicit confirmation + field/variant checks
  → confirm_order RPC: lock variant, check stock, compute trusted price/fee, insert CONFIRMED
  → stored response → WhatsApp reply → Supabase Realtime → owner dashboard
```

The model returns a variant ID, intent, name, city, address, quantity and a conversational reply. Size/color/product come from the selected database variant. It does not choose the price, phone, tenant, status or delivery fee. The sender phone comes from the authenticated worker event. Incomplete purchases remain conversations until explicitly confirmed; pending orders can be supported by the schema but incomplete chats do **not** create fake pending orders. This MVP handles one product variant per order.

The owner feed loads the latest **200 orders**, while catalog context for Gemini loads up to **100 active products**. Realtime updates and a 30-second fallback refresh are wired. CSV exports the currently loaded/filter-matched orders, with formula-injection protection. Metrics describe the loaded order feed, not lifetime accounting.

## Security and delivery semantics

- One owner per store; RLS is enabled on every application table. Nested product/variant foreign keys include `store_id`. No authorization depends on editable user metadata.
- Cookie-based auth refreshes in `proxy.ts`; every protected server operation re-verifies the user. API mutations also enforce the configured browser origin. Server-only keys never enter client bundles.
- Product edits are transactional. Existing variants are retained to preserve order references; set stock to zero rather than deleting a variant with history.
- Orders reserve stock under a database row lock; webhook replay cannot insert the same message twice. Cancel/reconfirm transitions return/reserve inventory once. Shipped orders are immutable through this MVP.
- Logo uploads are size- and magic-byte-checked, restricted to PNG/JPEG/WebP, stored privately, and served via short-lived owner-authorized signed URLs.
- Webhooks require HMAC signatures with a five-minute freshness window. Event leases and unique IDs handle retries. AI calls are capped at 100/store/hour. These guards do not replace managed edge/auth rate limiting.
- The worker uses AES-256-GCM encrypted SQLite for Baileys credentials, Signal keys, messages and replies; it does not use the demo-only `useMultiFileAuthState`. Keep its Docker volume private and backed up with the encryption key. The session key is shared across this worker; per-tenant KMS keys and rotation are future hardening.
- Jobs retry temporary webhook failures up to ten times before `needs_review`. A send is reserved before contacting WhatsApp: a crash/uncertain send becomes `delivery_unknown`, and is not blindly resent. Exactly-once external delivery is not promised. Queue counters are returned by the worker API; an operator retry/review UI is not included yet.
- Text-only, one linked account per store, direct customer chats only. Groups, audio, images, multi-item carts, refunds, billing, team roles and courier APIs are outside this initial MVP.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm --prefix worker ci
npm --prefix worker test
```

`tests/schema-bootstrap.sql` and `tests/schema-security.sql` validate the migration on a **temporary isolated PostgreSQL** fixture with Supabase-compatible auth/storage stubs: tenant isolation, restricted RPCs, idempotency, stock, cancellation and delivery pricing. They are test fixtures, not a replacement for an end-to-end test on your real Supabase project. Do not run the bootstrap on a Supabase project.

## Production readiness

This is an implemented, buildable MVP foundation, not a production certification. Before onboarding paying stores: connect a staging Supabase project and verify signup/email confirmation, logo upload, Realtime, QR pairing and the complete live customer → Gemini → order → reply flow; add HTTPS, production SMTP/CAPTCHA/edge rate limits, monitoring and queue review, retention/deletion jobs for customer data, backup/restore and key rotation, deployment secrets management and pagination. Review Moroccan customer-data obligations for your actual hosting and retention choices.

Baileys is an unofficial WhatsApp Web client. It does not carry Meta's official Business Platform guarantees and a link may be restricted or require re-pairing. Subscription-free software is not a guarantee of a cost-free production service; hosting, Supabase and Gemini have their own limits. For business-critical use evaluate the official WhatsApp Business Platform separately.

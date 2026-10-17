import http from "node:http";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createHmac, timingSafeEqual } from "node:crypto";
import makeWASocket, {
  DisconnectReason,
  Browsers,
  jidNormalizedUser,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import { sessionAuth, secretBox } from "./auth.mjs";
const token = process.env.WHATSAPP_WORKER_TOKEN,
  webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET,
  webhook = process.env.WHATSAPP_WEBHOOK_URL;
if (
  !token ||
  token.length < 32 ||
  !webhookSecret ||
  webhookSecret.length < 32 ||
  !webhook
)
  throw Error("Configure worker secrets and callback URL.");
const box = secretBox(process.env.WHATSAPP_SESSION_KEY),
  dir = process.env.STATE_DIR || "/state";
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(dir + "/worker.sqlite");
db.exec(
  `pragma journal_mode=WAL;create table if not exists auth(store_id text,kind text,id text,value text,primary key(store_id,kind,id));create table if not exists jobs(id text primary key,store_id text,phone text,payload text,state text default 'pending',reply text,attempts integer default 0,next_at integer default 0);create table if not exists sent(store_id text,id text,message text,primary key(store_id,id));`,
);
const logger = pino({ level: "silent" }),
  sessions = new Map();
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/;
function json(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}
async function connect(storeId) {
  const existing = sessions.get(storeId);
  if (existing && ["connected", "qr", "connecting"].includes(existing.state))
    return existing;
  const session = {
    state: "connecting",
    qr: null,
    phone: null,
    socket: null,
    timer: null,
  };
  sessions.set(storeId, session);
  const { state, saveCreds } = sessionAuth(db, box, storeId);
  const socket = makeWASocket({
    auth: state,
    logger,
    browser: Browsers.macOS("Chrome"),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    getMessage: async (key) => {
      const record = db
        .prepare("select message from sent where store_id=? and id=?")
        .get(storeId, key.id);
      return record ? box.decrypt(record.message) : undefined;
    },
  });
  session.socket = socket;
  socket.ev.on("creds.update", saveCreds);
  socket.ev.on("connection.update", (update) => {
    if (sessions.get(storeId) !== session) return;
    if (update.qr) {
      session.qr = update.qr;
      session.state = "qr";
    }
    if (update.connection === "open") {
      session.state = "connected";
      session.qr = null;
      session.phone = "+" + jidNormalizedUser(socket.user.id).split("@")[0];
    }
    if (update.connection === "close") {
      session.qr = null;
      if (
        update.lastDisconnect?.error?.output?.statusCode ===
        DisconnectReason.loggedOut
      ) {
        session.state = "logged_out";
        db.prepare("delete from auth where store_id=?").run(storeId);
      } else {
        session.state = "reconnecting";
        session.timer = setTimeout(
          () =>
            connect(storeId).catch(() => {
              session.state = "error";
            }),
          5000,
        );
      }
    }
  });
  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (
        msg.key.fromMe ||
        !msg.key.id ||
        !msg.key.remoteJid ||
        /@(g.us|broadcast|newsletter)$/.test(msg.key.remoteJid)
      )
        continue;
      const content = msg.message?.ephemeralMessage?.message || msg.message;
      const text = content?.conversation || content?.extendedTextMessage?.text;
      if (!text || text.length > 4000) continue;
      let jid = msg.key.remoteJidAlt || msg.key.remoteJid;
      if (jid.endsWith("@lid"))
        try {
          jid = await socket.signalRepository.lidMapping.getPNForLID(jid);
        } catch {
          continue;
        }
      if (!jid?.endsWith("@s.whatsapp.net")) continue;
      const phone = "+" + jidNormalizedUser(jid).split("@")[0];
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) continue;
      const eventId = storeId + ":" + msg.key.id;
      const event = {
        eventId,
        messageId: msg.key.id,
        storeId,
        phone,
        text,
        occurredAt: new Date().toISOString(),
      };
      const queued = db
        .prepare(
          "select count(*) as n from jobs where store_id=? and state in ('pending','reply_ready')",
        )
        .get(storeId).n;
      if (queued >= 1000) continue; // Bound queue growth; alerting/review required for higher volumes.
      db.prepare(
        "insert or ignore into jobs(id,store_id,phone,payload) values(?,?,?,?)",
      ).run(eventId, storeId, phone, box.encrypt(event));
    }
  });
  return session;
}
let running = false;
setInterval(async () => {
  if (running) return;
  running = true;
  try {
    const jobs = db
      .prepare(
        "select * from jobs j where state in ('pending','reply_ready') and next_at<=? and not exists (select 1 from jobs earlier where earlier.store_id=j.store_id and earlier.phone=j.phone and earlier.rowid<j.rowid and earlier.state in ('pending','reply_ready')) order by rowid limit 10",
      )
      .all(Date.now());
    for (const job of jobs) {
      const session = sessions.get(job.store_id);
      if (session?.state !== "connected") continue;
      try {
        const event = box.decrypt(job.payload);
        let reply = job.reply ? box.decrypt(job.reply) : null;
        if (job.state === "pending") {
          const raw = JSON.stringify(event),
            stamp = String(Date.now()),
            signature = createHmac("sha256", webhookSecret)
              .update(stamp + "." + raw)
              .digest("hex");
          const response = await fetch(webhook, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-wasla-timestamp": stamp,
              "x-wasla-signature": "sha256=" + signature,
            },
            body: raw,
            signal: AbortSignal.timeout(55000),
          });
          if (!response.ok) throw Error("Webhook unavailable");
          const result = await response.json();
          if (!result.ok) throw Error("Webhook rejected");
          reply = result.reply;
          db.prepare("update jobs set state=?,reply=? where id=?").run(
            reply ? "reply_ready" : "done",
            reply ? box.encrypt(reply) : null,
            job.id,
          );
        }
        if (reply) {
          // Persist reservation BEFORE external send. A crash gives 'delivery_unknown', not a duplicate customer message.
          db.prepare("update jobs set state='delivery_unknown' where id=?").run(
            job.id,
          );
          const result = await session.socket.sendMessage(
            event.phone.slice(1) + "@s.whatsapp.net",
            { text: reply },
          );
          if (result?.key?.id)
            db.prepare(
              "insert or replace into sent(store_id,id,message) values(?,?,?)",
            ).run(
              job.store_id,
              result.key.id,
              box.encrypt({ conversation: reply }),
            );
          db.prepare("update jobs set state='done' where id=?").run(job.id);
        }
      } catch {
        db.prepare(
          "update jobs set attempts=attempts+1,next_at=? where id=?",
        ).run(
          Date.now() + Math.min(300000, 5000 * 2 ** Math.min(job.attempts, 6)),
          job.id,
        );
        if (job.attempts >= 9)
          db.prepare(
            "update jobs set state='needs_review' where id=? and state<>'delivery_unknown'",
          ).run(job.id);
      }
    }
  } finally {
    running = false;
  }
}, 1000);
http
  .createServer(async (req, res) => {
    const actual = Buffer.from(req.headers.authorization || ""),
      expected = Buffer.from("Bearer " + token);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return json(res, 401, { error: "Unauthorized" });
    const match = /^\/sessions\/([a-f\d-]+)$/.exec(req.url || "");
    if (!match || !uuid.test(match[1]))
      return json(res, 404, { error: "Not found" });
    try {
      const id = match[1];
      let session = sessions.get(id);
      if (req.method === "POST") session = await connect(id);
      else if (req.method !== "GET")
        return json(res, 405, { error: "Method not allowed" });
      const counts = db
        .prepare(
          "select state,count(*) as count from jobs where store_id=? group by state",
        )
        .all(id);
      return json(res, 200, {
        state: session?.state || "disconnected",
        phone: session?.phone || null,
        qr: session?.qr
          ? await QRCode.toDataURL(session.qr, { width: 280, margin: 2 })
          : null,
        queue: counts,
      });
    } catch {
      return json(res, 503, { error: "Worker unavailable" });
    }
  })
  .listen(8091, "0.0.0.0", () =>
    console.log("Wasla private multi-store WhatsApp worker ready."),
  );
for (const { store_id } of db
  .prepare("select distinct store_id from auth where kind='creds'")
  .all())
  connect(store_id).catch(() => {});
process.on("SIGTERM", () => {
  for (const session of sessions.values()) {
    clearTimeout(session.timer);
    try {
      session.socket?.end(new Error("shutdown"));
    } catch {}
  }
  db.close();
  process.exit(0);
});

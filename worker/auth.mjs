import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { BufferJSON, initAuthCreds, proto } from "@whiskeysockets/baileys";
export function secretBox(encodedKey) {
  const key = Buffer.from(encodedKey || "", "base64");
  if (key.length !== 32)
    throw Error(
      "WHATSAPP_SESSION_KEY must be 32 random bytes, base64 encoded.",
    );
  return {
    encrypt(value) {
      const iv = randomBytes(12),
        cipher = createCipheriv("aes-256-gcm", key, iv);
      const bytes = Buffer.concat([
        cipher.update(JSON.stringify(value, BufferJSON.replacer)),
        cipher.final(),
      ]);
      return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64");
    },
    decrypt(value) {
      const bytes = Buffer.from(value, "base64"),
        decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(12, 28));
      return JSON.parse(
        Buffer.concat([
          decipher.update(bytes.subarray(28)),
          decipher.final(),
        ]).toString(),
        BufferJSON.reviver,
      );
    },
  };
}
export function sessionAuth(db, box, storeId) {
  const get = (kind, id) => {
    const row = db
      .prepare("select value from auth where store_id=? and kind=? and id=?")
      .get(storeId, kind, id);
    return row ? box.decrypt(row.value) : null;
  };
  const set = (kind, id, value) => {
    if (value == null)
      db.prepare("delete from auth where store_id=? and kind=? and id=?").run(
        storeId,
        kind,
        id,
      );
    else
      db.prepare(
        "insert into auth(store_id,kind,id,value) values(?,?,?,?) on conflict(store_id,kind,id) do update set value=excluded.value",
      ).run(storeId, kind, id, box.encrypt(value));
  };
  const creds = get("creds", "main") || initAuthCreds();
  return {
    state: {
      creds,
      keys: {
        async get(type, ids) {
          const values = {};
          for (const id of ids) {
            let value = get(type, id);
            if (type === "app-state-sync-key" && value)
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            if (value) values[id] = value;
          }
          return values;
        },
        async set(data) {
          db.exec("begin");
          try {
            for (const [kind, values] of Object.entries(data))
              for (const [id, value] of Object.entries(values))
                set(kind, id, value);
            db.exec("commit");
          } catch (error) {
            db.exec("rollback");
            throw error;
          }
        },
      },
    },
    saveCreds: () => set("creds", "main", creds),
  };
}

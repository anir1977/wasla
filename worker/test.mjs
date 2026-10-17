import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { secretBox, sessionAuth } from "./auth.mjs";
test("session encryption authenticates ciphertext and preserves binary keys", () => {
  const box = secretBox(randomBytes(32).toString("base64"));
  const value = { secret: Buffer.from("private key"), id: 123 };
  const cipher = box.encrypt(value);
  assert.ok(!cipher.includes("private key"));
  assert.deepEqual(box.decrypt(cipher), value);
  const altered = Buffer.from(cipher, "base64");
  altered[30] ^= 1;
  assert.throws(() => box.decrypt(altered.toString("base64")));
  assert.throws(() => secretBox("bad-key"));
});
test("two stores cannot read each other’s encrypted auth keys", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "create table auth(store_id text,kind text,id text,value text,primary key(store_id,kind,id))",
  );
  const box = secretBox(randomBytes(32).toString("base64"));
  const a = sessionAuth(db, box, "store-a"),
    b = sessionAuth(db, box, "store-b");
  await a.state.keys.set({
    session: { "customer-1": { data: Buffer.from("secret-a") } },
  });
  assert.equal(
    (await b.state.keys.get("session", ["customer-1"]))["customer-1"],
    undefined,
  );
  assert.deepEqual(
    (await a.state.keys.get("session", ["customer-1"]))["customer-1"].data,
    Buffer.from("secret-a"),
  );
  a.saveCreds();
  const restored = sessionAuth(db, box, "store-a");
  assert.deepEqual(restored.state.creds.noiseKey, a.state.creds.noiseKey);
  db.close();
});

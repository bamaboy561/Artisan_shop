import assert from "node:assert/strict";
import test from "node:test";
import * as crypto from "node:crypto";
import * as bcrypt from "bcryptjs";
import * as zod from "zod";
import * as jose from "jose";
import { readFileSync } from "node:fs";
import { loadAction } from "./load-action.mjs";

function fixture() {
  const settings = new Map();
  const user = { id: "client1", email: "client@example.test", hashedPassword: "old-hash", isActive: true, loyaltyPointsBalance: 123, role: { code: "CUSTOMER" } };
  const sent = [], writes = [];
  let configured = true, allow = true, tail = Promise.resolve();
  const db = {
    $queryRaw: async () => allow ? [{ id: "counter" }] : [],
    user: {
      findUnique: async ({ where }) => (!where.email || where.email === user.email) && (!where.id || where.id === user.id) ? { ...user } : null,
      updateMany: async ({ where, data }) => {
        if (where.hashedPassword !== user.hashedPassword || where.email !== user.email || !user.isActive) return { count: 0 };
        writes.push(data);
        Object.assign(user, data);
        return { count: 1 };
      },
    },
    siteSetting: {
      findUnique: async ({ where }) => settings.has(where.key) ? { key: where.key, value: settings.get(where.key) } : null,
      upsert: async ({ where, create, update }) => { settings.set(where.key, settings.has(where.key) ? update.value : create.value); },
      deleteMany: async ({ where }) => {
        if (!settings.has(where.key) || settings.get(where.key).tokenHash !== where.value.equals) return { count: 0 };
        settings.delete(where.key);
        return { count: 1 };
      },
    },
    $transaction: (callback) => {
      const next = tail.then(async () => {
        const previous = new Map(settings), old = { ...user };
        try { return await callback(db); }
        catch (error) { settings.clear(); for (const entry of previous) settings.set(...entry); Object.assign(user, old); throw error; }
      });
      tail = next.catch(() => {});
      return next;
    },
  };
  const recovery = loadAction("../lib/server/password-recovery.ts", {
    "server-only": {}, "node:crypto": crypto, bcryptjs: bcrypt, zod,
    "@/lib/db": { getDb: () => db, hasDatabaseUrl: () => configured },
  });
  return { recovery, db, settings, user, sent, writes, disable: () => { configured = false; }, limit: () => { allow = false; } };
}

async function withEmail(callback) {
  const previous = { fetch: globalThis.fetch, key: process.env.RESEND_API_KEY, from: process.env.AUTH_EMAIL_FROM };
  process.env.RESEND_API_KEY = "test-only";
  process.env.AUTH_EMAIL_FROM = "Artisan <no-reply@artisan.shop.kg>";
  const sent = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.resend.com/emails");
    sent.push(JSON.parse(options.body));
    return new Response("{}", { status: 200 });
  };
  try { await callback(sent); }
  finally {
    globalThis.fetch = previous.fetch;
    for (const [name, value] of [["RESEND_API_KEY", previous.key], ["AUTH_EMAIL_FROM", previous.from]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
}

function tokenFrom(sent) {
  const url = sent[0].text.match(/https:\/\/artisan\.shop\.kg\/reset-password\?token=\S+/)[0];
  return new URL(url).searchParams.get("token");
}

test("recovery email uses canonical site, random token, stores only its digest; requesting never changes the account", async () => withEmail(async (sent) => {
  const f = fixture();
  await f.recovery.requestPasswordRecovery(" CLIENT@EXAMPLE.TEST ");
  const token = tokenFrom(sent), record = f.settings.get("password-reset:client1");
  assert.match(token, /^client1\.[a-f0-9]{64}$/);
  assert.equal(record.tokenHash, crypto.createHash("sha256").update(token).digest("hex"));
  assert.equal(JSON.stringify(record).includes(token), false);
  assert.ok(record.expiresAt > Date.now() + 29 * 60 * 1000);
  assert.ok(record.expiresAt <= Date.now() + 30 * 60 * 1000);
  assert.equal(f.user.hashedPassword, "old-hash");
  assert.equal(f.writes.length, 0);
}));

test("successful recovery changes only password, consumes token, revokes sessions and notifies without sending password", async () => withEmail(async (sent) => {
  const f = fixture();
  await f.recovery.requestPasswordRecovery(f.user.email);
  const token = tokenFrom(sent);
  assert.equal(await f.recovery.resetRecoveredPassword(token, "new-password123", "new-password123"), true);
  assert.equal(await bcrypt.compare("new-password123", f.user.hashedPassword), true);
  assert.deepEqual(Object.keys(f.writes[0]), ["hashedPassword"]);
  assert.equal(f.user.loyaltyPointsBalance, 123);
  assert.equal(f.settings.has("password-reset:client1"), false);
  assert.ok(f.settings.get("session-revocation:client1").revokedBefore);
  assert.equal(sent.length, 2);
  assert.equal(JSON.stringify(sent).includes("new-password123"), false);
  assert.equal(await f.recovery.resetRecoveredPassword(token, "other-password", "other-password"), false);
}));

test("expired, replaced, malformed tokens, blocked users, changed email/password and mismatched passwords fail", async () => withEmail(async (sent) => {
  for (const change of ["expired", "blocked", "email", "password", "replaced", "mismatch"]) {
    sent.length = 0;
    const f = fixture();
    await f.recovery.requestPasswordRecovery(f.user.email);
    const token = tokenFrom(sent);
    if (change === "expired") f.settings.get("password-reset:client1").expiresAt = Date.now() - 1;
    if (change === "blocked") f.user.isActive = false;
    if (change === "email") f.user.email = "changed@example.test";
    if (change === "password") f.user.hashedPassword = "changed-hash";
    if (change === "replaced") await f.recovery.requestPasswordRecovery(f.user.email);
    assert.equal(await f.recovery.resetRecoveredPassword(token, "new-password123", change === "mismatch" ? "not-the-same" : "new-password123"), false, change);
    assert.equal(f.writes.length, 0);
  }
  const f = fixture();
  for (const token of ["", "../.abcdef", "x." + "z".repeat(64), "a".repeat(1000)]) assert.equal(f.recovery.parseRecoveryToken(token), null);
  assert.equal(f.recovery.recoveryPasswordSchema.safeParse({ password: "я".repeat(37), confirmPassword: "я".repeat(37) }).success, false);
}));

test("two concurrent resets accept only one submission", async () => withEmail(async (sent) => {
  const f = fixture();
  await f.recovery.requestPasswordRecovery(f.user.email);
  const token = tokenFrom(sent);
  const results = await Promise.all([
    f.recovery.resetRecoveredPassword(token, "password-one", "password-one"),
    f.recovery.resetRecoveredPassword(token, "password-two", "password-two"),
  ]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(f.writes.length, 1);
}));

test("failed delivery removes only its link; failed password write rolls the token back", async () => withEmail(async () => {
  const f = fixture();
  const goodFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("provider error", { status: 403 });
  await assert.rejects(f.recovery.requestPasswordRecovery(f.user.email), /403/);
  assert.equal(f.settings.has("password-reset:client1"), false);
  assert.equal(f.user.hashedPassword, "old-hash");
  globalThis.fetch = goodFetch;
  const sent = [];
  globalThis.fetch = async (_url, options) => { sent.push(JSON.parse(options.body)); return new Response("{}", { status: 200 }); };
  await f.recovery.requestPasswordRecovery(f.user.email);
  const token = tokenFrom(sent);
  f.db.user.updateMany = async () => ({ count: 0 });
  await assert.rejects(f.recovery.resetRecoveredPassword(token, "new-password", "new-password"), /concurrently/);
  assert.equal(f.settings.has("password-reset:client1"), true);
  assert.equal(f.settings.has("session-revocation:client1"), false);
  assert.equal(f.user.hashedPassword, "old-hash");
}));

test("unknown users, disabled email/database and rate limiting do not send mail or change passwords", async () => withEmail(async (sent) => {
  const f = fixture();
  await f.recovery.requestPasswordRecovery("unknown@example.test");
  f.limit();
  await f.recovery.requestPasswordRecovery(f.user.email);
  f.disable();
  await f.recovery.requestPasswordRecovery(f.user.email);
  assert.equal(sent.length, 0);
  assert.equal(f.settings.size, 0);
  delete process.env.AUTH_EMAIL_FROM;
  assert.equal(fixture().recovery.isPasswordRecoveryConfigured(), false);
}));

test("request action responds identically without waiting for account lookup or email delivery", async () => {
  const scheduled = [], requested = [];
  let configured = true;
  const recovery = fixture().recovery;
  const actions = loadAction("../app/auth/password-recovery-actions.ts", {
    "next/server": { after: (callback) => scheduled.push(callback) },
    "@/lib/auth/session": { destroySession: async () => {} },
    "@/lib/server/password-recovery": { ...recovery, isPasswordRecoveryConfigured: () => configured, requestPasswordRecovery: async (email) => requested.push(email) },
  });
  const form = (email) => { const f = new FormData(); f.set("email", email); return f; };
  const known = await actions.requestPasswordRecoveryAction({}, form("client@example.test"));
  const unknown = await actions.requestPasswordRecoveryAction({}, form("unknown@example.test"));
  assert.deepEqual(known, unknown);
  assert.equal(requested.length, 0);
  for (const callback of scheduled) await callback();
  assert.equal(requested.length, 2);
  configured = false;
  assert.equal((await actions.requestPasswordRecoveryAction({}, form("client@example.test"))).success, undefined);
  assert.equal(scheduled.length, 2);
});

test("legacy/new sessions are rejected only when issued before password recovery; blocked accounts remain blocked", async () => {
  let session = { userId: "client1", issuedAtMilliseconds: 99 };
  let active = true, revocation = null;
  const dal = loadAction("../lib/auth/dal.ts", {
    "server-only": {}, react: { cache: (fn) => fn }, "next/navigation": {},
    "@/generated/prisma": {}, "@/lib/auth/redirects": {}, "@/lib/auth/roles": {},
    "@/lib/auth/session": { readSession: async () => session },
    "@/lib/db": { hasDatabaseUrl: () => true, getDb: () => ({
      user: { findUnique: async () => ({ id: "client1", isActive: active, role: { code: "CUSTOMER" } }) },
      siteSetting: { findUnique: async () => revocation },
    }) },
  });
  assert.ok(await dal.getOptionalSession());
  revocation = { value: { revokedBefore: 100 } };
  assert.equal(await dal.getOptionalSession(), null);
  session = { userId: "client1" };
  assert.equal(await dal.getOptionalSession(), null);
  session.issuedAtMilliseconds = 101;
  assert.ok(await dal.getOptionalSession());
  active = false;
  assert.equal(await dal.getOptionalSession(), null);
});

test("signed session issuance timestamp cannot be supplied by a caller; old JWT iat remains supported", async () => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-secret-abcdefghijklmnopqrstuvwxyz";
  try {
    const session = loadAction("../lib/auth/session.ts", { jose, "next/headers": {} });
    const token = await session.encryptSession({ userId: "client1", roleCode: "CUSTOMER", email: "client@example.test", issuedAtMilliseconds: 99999999999999 });
    assert.ok((await session.decryptSession(token)).issuedAtMilliseconds <= Date.now());
    const legacy = await new jose.SignJWT({ userId: "client1", roleCode: "CUSTOMER", email: "client@example.test" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(process.env.SESSION_SECRET));
    assert.ok((await session.decryptSession(legacy)).issuedAtMilliseconds > 0);
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous;
  }
});

test("recovery pages are noindex, no-referrer and login has recovery link", () => {
  for (const path of ["../app/forgot-password/page.tsx", "../app/reset-password/page.tsx"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /robots: noIndexRobots/);
    assert.match(source, /referrer: "no-referrer"/);
  }
  assert.match(readFileSync(new URL("../app/login/login-form.tsx", import.meta.url), "utf8"), /href="\/forgot-password"/);
});

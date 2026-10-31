import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getDb, hasDatabaseUrl } from "@/lib/db";

const resetRecordSchema = z.object({
  tokenHash: z.string().length(64),
  expiresAt: z.number().finite(),
  passwordFingerprint: z.string().length(64),
  email: z.string(),
});

export const recoveryEmailSchema = z.string().trim().toLowerCase().max(254).email();
export const recoveryPasswordSchema = z.object({
  password: z.string().min(8).max(128).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword);

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function isPasswordRecoveryConfigured() {
  return hasDatabaseUrl() && Boolean(process.env.RESEND_API_KEY?.trim() && process.env.AUTH_EMAIL_FROM?.trim());
}

export function parseRecoveryToken(token: string) {
  const match = /^([a-zA-Z0-9_-]{1,100})\.([a-f0-9]{64})$/.exec(token);
  return match ? { userId: match[1], tokenHash: digest(token) } : null;
}

async function sendRecoveryEmail(email: string, subject: string, text: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.AUTH_EMAIL_FROM?.trim(), to: [email], subject, text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Recovery email delivery failed (${response.status})`);
}

async function claimRecoveryAttempt(key: string, maximum: number, cooldownSeconds: number) {
  const day = new Date().toISOString().slice(0, 10);
  const rows = await getDb().$queryRaw<Array<{ id: string }>>`
    INSERT INTO "SiteSetting" ("id", "key", "value", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${key}, jsonb_build_object('day', ${day}::text, 'count', 1), NOW(), NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "value" = jsonb_build_object('day', ${day}::text, 'count',
        CASE WHEN "SiteSetting"."value"->>'day' = ${day}::text
        THEN ("SiteSetting"."value"->>'count')::int + 1 ELSE 1 END),
      "updatedAt" = NOW()
    WHERE "SiteSetting"."updatedAt" <= NOW() - (${cooldownSeconds}::int * INTERVAL '1 second')
      AND ("SiteSetting"."value"->>'day' <> ${day}::text
        OR ("SiteSetting"."value"->>'count')::int < ${maximum}::int)
    RETURNING "id"
  `;
  return rows.length > 0;
}

// Called after the response, so email delivery cannot reveal whether an account exists.
export async function requestPasswordRecovery(emailInput: string) {
  const parsed = recoveryEmailSchema.safeParse(emailInput);
  if (!parsed.success || !isPasswordRecoveryConfigured()) return;
  const email = parsed.data;
  if (!await claimRecoveryAttempt("password-recovery-global-limit", 1000, 0)) return;
  if (!await claimRecoveryAttempt(`password-recovery-limit:${digest(email)}`, 5, 60)) return;
  const db = getDb();
  const user = await db.user.findUnique({
    where: { email }, select: { id: true, email: true, hashedPassword: true, isActive: true },
  });
  if (!user?.isActive || !user.hashedPassword) return;
  const token = `${user.id}.${randomBytes(32).toString("hex")}`;
  const tokenHash = digest(token);
  const key = `password-reset:${user.id}`;
  const value = {
    tokenHash, expiresAt: Date.now() + 30 * 60 * 1000,
    passwordFingerprint: digest(user.hashedPassword), email: user.email,
  };
  await db.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  try {
    // Never derive a recovery link from an untrusted Host header.
    const url = `https://artisan.shop.kg/reset-password?token=${encodeURIComponent(token)}`;
    await sendRecoveryEmail(email, "Восстановление пароля Artisan",
      `Для смены пароля откройте ссылку:\n${url}\n\nСсылка действует 30 минут и только один раз.\nЕсли вы не запрашивали смену пароля, проигнорируйте это письмо.`);
  } catch (error) {
    await db.siteSetting.deleteMany({ where: { key, value: { path: ["tokenHash"], equals: tokenHash } } });
    throw error;
  }
}

export async function resetRecoveredPassword(token: string, password: string, confirmPassword: string) {
  const parsedToken = parseRecoveryToken(token);
  const parsedPassword = recoveryPasswordSchema.safeParse({ password, confirmPassword });
  if (!parsedToken || !parsedPassword.success || !hasDatabaseUrl()) return false;
  const db = getDb();
  const key = `password-reset:${parsedToken.userId}`;
  const preliminary = resetRecordSchema.safeParse((await db.siteSetting.findUnique({ where: { key } }))?.value);
  if (!preliminary.success || preliminary.data.tokenHash !== parsedToken.tokenHash || preliminary.data.expiresAt <= Date.now()) return false;
  const hashedPassword = await hash(parsedPassword.data.password, 10);
  const email = await db.$transaction(async (tx) => {
    const record = await tx.siteSetting.findUnique({ where: { key } });
    const parsed = resetRecordSchema.safeParse(record?.value);
    if (!parsed.success || parsed.data.tokenHash !== parsedToken.tokenHash || parsed.data.expiresAt <= Date.now()) return null;
    const user = await tx.user.findUnique({ where: { id: parsedToken.userId }, select: { email: true, hashedPassword: true, isActive: true } });
    if (!user?.isActive || !user.hashedPassword || user.email !== parsed.data.email || digest(user.hashedPassword) !== parsed.data.passwordFingerprint) return null;
    // Atomic consumption prevents two concurrent submissions from using the same link.
    const consumed = await tx.siteSetting.deleteMany({ where: {
      key, value: { path: ["tokenHash"], equals: parsedToken.tokenHash },
      AND: [{ value: { path: ["expiresAt"], gt: Date.now() } }],
    } });
    if (consumed.count !== 1) return null;
    const changed = await tx.user.updateMany({
      where: { id: parsedToken.userId, email: user.email, hashedPassword: user.hashedPassword, isActive: true },
      data: { hashedPassword },
    });
    if (changed.count !== 1) throw new Error("Recovery account changed concurrently");
    const revokedKey = `session-revocation:${parsedToken.userId}`;
    const value = { revokedBefore: Date.now() };
    await tx.siteSetting.upsert({ where: { key: revokedKey }, create: { key: revokedKey, value }, update: { value } });
    return user.email;
  });
  if (!email) return false;
  // A notification failure must not roll back a successful password change.
  try {
    await sendRecoveryEmail(email, "Пароль Artisan изменён",
      "Пароль вашего аккаунта Artisan изменён. Прежние сеансы завершены. Войдите с новым паролем: https://artisan.shop.kg/login\nЕсли это сделали не вы, обратитесь в Artisan: +996502788118.");
  } catch { console.error("[password-recovery:notification-failed]"); }
  return true;
}

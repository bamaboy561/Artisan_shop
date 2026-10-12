import "server-only";

import crypto from "node:crypto";

const clientQrPrefix = "artisan-client-v1";
const clientQrLifetimeSeconds = 15 * 60;

function getClientQrSecret() {
  const secret = process.env.CLIENT_QR_SECRET || process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("CLIENT_QR_SECRET or SESSION_SECRET is not configured.");
  }

  return secret;
}

function sign(value: string) {
  return crypto
    .createHmac("sha256", getClientQrSecret())
    .update(value)
    .digest("base64url");
}

export function createClientQrPayload(userId: string, now = new Date()) {
  const expiresAt = Math.floor(now.getTime() / 1000) + clientQrLifetimeSeconds;
  const data = Buffer.from(`${userId}.${expiresAt}`).toString("base64url");

  return `${clientQrPrefix}:${data}.${sign(data)}`;
}

export function verifyClientQrPayload(value: string, now = new Date()) {
  const token = value.trim();

  if (!token.startsWith(`${clientQrPrefix}:`)) {
    return null;
  }

  const [data, signature] = token.slice(clientQrPrefix.length + 1).split(".");
  if (!data || !signature) {
    return null;
  }

  const expectedSignature = sign(data);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  const decoded = Buffer.from(data, "base64url").toString("utf8");
  const separatorIndex = decoded.lastIndexOf(".");
  const userId = decoded.slice(0, separatorIndex);
  const expiresAt = Number.parseInt(decoded.slice(separatorIndex + 1), 10);

  if (!userId || !Number.isFinite(expiresAt)) {
    return null;
  }

  if (expiresAt < Math.floor(now.getTime() / 1000)) {
    return null;
  }

  return { userId, expiresAt };
}

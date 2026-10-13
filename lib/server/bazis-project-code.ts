import "server-only";

import crypto from "node:crypto";

import { getDb, hasDatabaseUrl } from "@/lib/db";
import { BAZIS_PART_LINK_DAYS } from "@/lib/server/bazis-part-link";

// Короткий код проекта для этикеток GibLab. Оператор вписывает его в
// название проекта в GibLab, и QR-код на этикетке ведёт на страницу детали:
// код проекта + номер позиции. Код случайный, поэтому адрес чужого проекта
// не подобрать. Живёт столько же, сколько ссылки с этикеток сайта.
const CODE_PREFIX = "bazis-code:";
const FILE_PREFIX = "bazis-code-for:";
// Без похожих знаков: 0 и O, 1 и I.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const LIFETIME_MS = BAZIS_PART_LINK_DAYS * 24 * 60 * 60 * 1000;

type StoredCode = { requestId: string; fileId: string; expiresAt: string };

function randomCode() {
  return Array.from(
    crypto.randomBytes(CODE_LENGTH),
    (byte) => ALPHABET[byte % ALPHABET.length],
  ).join("");
}

function readStored(value: unknown): StoredCode | null {
  const stored = value as Partial<StoredCode> | null;

  return stored &&
    typeof stored.requestId === "string" &&
    typeof stored.fileId === "string" &&
    typeof stored.expiresAt === "string"
    ? (stored as StoredCode)
    : null;
}

// Код для файла проекта: действующий или новый, если прежний истёк.
export async function getOrCreateBazisProjectCode(
  requestId: string,
  fileId: string,
  now = new Date(),
) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const db = getDb();
  const fileKey = `${FILE_PREFIX}${requestId}:${fileId}`;
  const current = await db.siteSetting.findUnique({ where: { key: fileKey } });
  const currentCode = typeof current?.value === "string" ? current.value : null;

  if (currentCode) {
    const stored = readStored(
      (
        await db.siteSetting.findUnique({
          where: { key: `${CODE_PREFIX}${currentCode}` },
        })
      )?.value,
    );

    if (stored && new Date(stored.expiresAt).getTime() > now.getTime()) {
      return { code: currentCode, expiresAt: new Date(stored.expiresAt) };
    }
  }

  const code = randomCode();
  const expiresAt = new Date(now.getTime() + LIFETIME_MS);
  const value: StoredCode = {
    requestId,
    fileId,
    expiresAt: expiresAt.toISOString(),
  };

  await db.siteSetting.create({
    data: {
      key: `${CODE_PREFIX}${code}`,
      value,
      description: "Код проекта Базиса для этикеток GibLab",
    },
  });
  await db.siteSetting.upsert({
    where: { key: fileKey },
    create: { key: fileKey, value: code },
    update: { value: code },
  });

  return { code, expiresAt };
}

// Ищет код в тексте из QR. Туда попадает всё название проекта GibLab,
// поэтому проверяем каждое слово подходящей длины.
export async function resolveBazisProjectCode(text: string, now = new Date()) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const candidates = [
    ...new Set(
      text
        .toUpperCase()
        .split(/[^A-Z0-9]+/)
        .filter((word) => word.length === CODE_LENGTH),
    ),
  ].slice(0, 8);

  if (candidates.length === 0) {
    return null;
  }

  const rows = await getDb().siteSetting.findMany({
    where: { key: { in: candidates.map((code) => `${CODE_PREFIX}${code}`) } },
  });

  for (const row of rows) {
    const stored = readStored(row.value);

    if (stored) {
      return new Date(stored.expiresAt).getTime() > now.getTime()
        ? { requestId: stored.requestId, fileId: stored.fileId }
        : ("expired" as const);
    }
  }

  return null;
}

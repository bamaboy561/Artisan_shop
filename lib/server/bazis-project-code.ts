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

// fileIds — все файлы Базиса заявки по порядку, если их несколько: они
// собраны в один проект GibLab, и позиция детали там «2-5» (файл 2, поз. 5).
type StoredCode = {
  requestId: string;
  fileId: string;
  expiresAt: string;
  fileIds?: string[];
};

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
    ? {
        requestId: stored.requestId,
        fileId: stored.fileId,
        expiresAt: stored.expiresAt,
        fileIds:
          Array.isArray(stored.fileIds) &&
          stored.fileIds.every((id) => typeof id === "string")
            ? stored.fileIds
            : undefined,
      }
    : null;
}

const sameList = (a: string[] | undefined, b: string[] | undefined) =>
  (a ?? []).join("|") === (b ?? []).join("|");

// Код для файла проекта: действующий или новый, если прежний истёк.
// allFileIds — все файлы Базиса заявки, когда их больше одного: код один на
// заявку и ключ у него по первому файлу, поэтому прежние коды не меняются.
export async function getOrCreateBazisProjectCode(
  requestId: string,
  fileId: string,
  now = new Date(),
  allFileIds?: string[],
) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const fileIds =
    allFileIds && allFileIds.length > 1 && allFileIds[0] === fileId
      ? allFileIds
      : undefined;

  const db = getDb();
  const fileKey = `${FILE_PREFIX}${requestId}:${fileId}`;
  const current = await db.siteSetting.findUnique({ where: { key: fileKey } });
  const currentCode = typeof current?.value === "string" ? current.value : null;

  if (currentCode) {
    const codeKey = `${CODE_PREFIX}${currentCode}`;
    const stored = readStored(
      (await db.siteSetting.findUnique({ where: { key: codeKey } }))?.value,
    );

    if (stored && new Date(stored.expiresAt).getTime() > now.getTime()) {
      // В заявку добавили файл Базиса — код тот же, список файлов новый.
      // Только когда список знаем: страница одного файла его не передаёт.
      if (allFileIds && !sameList(stored.fileIds, fileIds)) {
        await db.siteSetting.update({
          where: { key: codeKey },
          data: {
            value: {
              requestId: stored.requestId,
              fileId: stored.fileId,
              expiresAt: stored.expiresAt,
              ...(fileIds ? { fileIds } : {}),
            },
          },
        });
      }

      return { code: currentCode, expiresAt: new Date(stored.expiresAt) };
    }
  }

  const code = randomCode();
  const expiresAt = new Date(now.getTime() + LIFETIME_MS);
  const value: StoredCode = {
    requestId,
    fileId,
    expiresAt: expiresAt.toISOString(),
    ...(fileIds ? { fileIds } : {}),
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
        ? {
            requestId: stored.requestId,
            fileId: stored.fileId,
            fileIds: stored.fileIds ?? [stored.fileId],
          }
        : ("expired" as const);
    }
  }

  return null;
}

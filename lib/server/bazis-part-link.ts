import "server-only";

import crypto from "node:crypto";

// Ссылка из QR-кода на этикетке детали: открывает страницу, где видно, в
// каком месте изделия стоит деталь. Страницу открывает сборщик с телефона
// без входа на сайт, поэтому в ссылке лежит подпись: подобрать адрес чужого
// проекта нельзя. Ссылка живёт месяц со дня печати этикеток.
export const BAZIS_PART_LINK_DAYS = 31;
const DAY_MS = 24 * 60 * 60 * 1000;
function getSecret() {
  const secret =
    process.env.BAZIS_PART_SECRET ||
    process.env.CLIENT_QR_SECRET ||
    process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is not configured.");
  }

  return secret;
}

// Короткая подпись, чтобы QR-код оставался крупным и читался с этикетки.
function sign(data: string) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(`bazis-part-v1:${data}`)
    .digest("base64url")
    .slice(0, 16);
}

export type BazisPartRef = {
  requestId: string;
  fileId: string;
  panelIndex: number;
};

export function createBazisPartToken(ref: BazisPartRef, now = new Date()) {
  // Срок храним номером дня: так код короче.
  const expiresDay = Math.floor(now.getTime() / DAY_MS) + BAZIS_PART_LINK_DAYS;
  const data = Buffer.from(
    `${ref.requestId}|${ref.fileId}|${ref.panelIndex}|${expiresDay}`,
  ).toString("base64url");

  return `${data}.${sign(data)}`;
}

export function verifyBazisPartToken(
  token: string,
  now = new Date(),
): BazisPartRef | "expired" | null {
  const [data, signature, ...rest] = token.trim().split(".");

  if (!data || !signature || rest.length > 0 || data.length > 400) {
    return null;
  }

  let expected: string;

  try {
    expected = sign(data);
  } catch {
    return null;
  }

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  const [requestId, fileId, index, day] = Buffer.from(data, "base64url")
    .toString("utf8")
    .split("|");
  const panelIndex = Number.parseInt(index ?? "", 10);
  const expiresDay = Number.parseInt(day ?? "", 10);

  if (
    !requestId ||
    !fileId ||
    !Number.isInteger(panelIndex) ||
    panelIndex < 0
  ) {
    return null;
  }

  if (!Number.isInteger(expiresDay)) {
    return null;
  }

  if (Math.floor(now.getTime() / DAY_MS) > expiresDay) {
    return "expired";
  }

  return { requestId, fileId, panelIndex };
}

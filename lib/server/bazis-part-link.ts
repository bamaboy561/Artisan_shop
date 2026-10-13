import "server-only";

import crypto from "node:crypto";

// Ссылка из QR-кода на этикетке детали: открывает страницу, где видно, в
// каком месте изделия стоит деталь. Страницу открывает сборщик с телефона
// без входа на сайт, поэтому в ссылке лежит подпись: подобрать адрес чужого
// проекта нельзя. Срока у ссылки нет: мебель могут собирать через месяц.
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

export function createBazisPartToken(ref: BazisPartRef) {
  const data = Buffer.from(
    `${ref.requestId}|${ref.fileId}|${ref.panelIndex}`,
  ).toString("base64url");

  return `${data}.${sign(data)}`;
}

export function verifyBazisPartToken(token: string): BazisPartRef | null {
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

  const [requestId, fileId, index] = Buffer.from(data, "base64url")
    .toString("utf8")
    .split("|");
  const panelIndex = Number.parseInt(index ?? "", 10);

  if (
    !requestId ||
    !fileId ||
    !Number.isInteger(panelIndex) ||
    panelIndex < 0
  ) {
    return null;
  }

  return { requestId, fileId, panelIndex };
}

import type { NextRequest } from "next/server";

import {
  CutListPhotoError,
  type CutListPhotoResponse,
} from "@/features/services/cut-list-photo-result";
import { decryptSession, sessionCookieName } from "@/lib/auth/session";
import {
  claimCutListPhotoAttempt,
  isCutListPhotoEnabled,
  prepareCutListPhoto,
  recognizeCutListPhoto,
} from "@/lib/server/cut-list-photo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Распознавание ждёт модель до 75 секунд.
export const maxDuration = 90;

function fail(error: string, status: number) {
  return Response.json({ ok: false, error } satisfies CutListPhotoResponse, {
    status,
  });
}

async function clientId(request: NextRequest) {
  const session = await decryptSession(
    request.cookies.get(sessionCookieName)?.value,
  );
  if (session?.userId) return `user:${session.userId}`;
  const ip =
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return `ip:${ip}`;
}

// Фото никуда не сохраняется: распознаём детали и сразу отдаём калькулятору.
export async function POST(request: NextRequest) {
  if (!isCutListPhotoEnabled())
    return fail(
      "Распознавание фото пока не подключено. Прикрепите фото к заявке, менеджер разберёт его.",
      503,
    );

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return fail("Не получилось принять фото.", 400);
  }
  if (!(file instanceof File) || file.size === 0)
    return fail("Выберите фото списка деталей.", 400);

  try {
    const image = await prepareCutListPhoto(file);
    const claim = await claimCutListPhotoAttempt(await clientId(request));
    if (claim === "client")
      return fail(
        "Слишком много фото подряд. Подождите немного или прикрепите фото к заявке.",
        429,
      );
    if (claim === "site")
      return fail(
        "Распознавание на сегодня исчерпано. Прикрепите фото к заявке, менеджер разберёт его.",
        429,
      );

    const result = await recognizeCutListPhoto(image);
    return Response.json({ ok: true, ...result } satisfies CutListPhotoResponse);
  } catch (error) {
    return fail(
      error instanceof CutListPhotoError
        ? error.message
        : "Не получилось распознать фото. Прикрепите его к заявке, менеджер разберёт его.",
      422,
    );
  }
}

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import type { RoleCode } from "@/generated/prisma";

export const sessionCookieName = "artisan-session";

export type SessionPayload = {
  userId: string;
  roleCode: RoleCode;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Add it to .env before using authentication.",
    );
  }

  return new TextEncoder().encode(secret);
}

export function isSessionConfigured() {
  return Boolean(process.env.SESSION_SECRET);
}

export async function encryptSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionSecret());
}

export async function decryptSession(
  session: string | undefined,
): Promise<SessionPayload | null> {
  if (!session) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(session, getSessionSecret(), {
      algorithms: ["HS256"],
    });

    return {
      userId: String(payload.userId),
      roleCode: payload.roleCode as RoleCode,
      email: String(payload.email),
      firstName:
        typeof payload.firstName === "string" ? payload.firstName : null,
      lastName: typeof payload.lastName === "string" ? payload.lastName : null,
    };
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload) {
  const token = await encryptSession(payload);
  const cookieStore = await cookies();

  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}

export async function readSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  return decryptSession(token);
}

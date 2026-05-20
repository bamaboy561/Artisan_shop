import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

import { type RoleCode } from "@/generated/prisma";

const sessionCookieName = "artisan-session";

const adminRoleCodes = new Set<RoleCode>([
  "MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
] as RoleCode[]);

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

async function getSessionPayload(request: NextRequest) {
  const secret = getSessionSecret();
  if (!secret) return null;

  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return {
      userId: String(payload.userId),
      roleCode: payload.roleCode as RoleCode,
    };
  } catch {
    return null;
  }
}

function isProtectedRoute(pathname: string) {
  return pathname.startsWith("/admin") || pathname.startsWith("/account");
}

function isAuthRoute(pathname: string) {
  return pathname === "/login" || pathname === "/register";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session = await getSessionPayload(request);

  if (session && isAuthRoute(pathname)) {
    const isAdmin = adminRoleCodes.has(session.roleCode);
    const target = isAdmin ? "/admin" : "/account";
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (!session && isProtectedRoute(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session && pathname.startsWith("/admin")) {
    if (!adminRoleCodes.has(session.roleCode)) {
      return NextResponse.redirect(new URL("/account", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/account/:path*",
    "/login",
    "/register",
  ],
};
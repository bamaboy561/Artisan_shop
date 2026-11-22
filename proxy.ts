import { NextResponse, type NextRequest } from "next/server";

import { getSafeRedirectPath } from "@/lib/auth/redirects";
import {
  canAccessAdmin,
  canAccessAdminPath,
  getAdminHomePath,
} from "@/lib/auth/roles";
import { decryptSession, sessionCookieName } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionToken = request.cookies.get(sessionCookieName)?.value;
  const session = await decryptSession(sessionToken);

  const isAccountRoute = pathname.startsWith("/account");
  const isAdminRoute = pathname.startsWith("/admin");
  // Программа раскроя цеха — только для сотрудников с доступом в админку.
  const isRaskroyRoute = pathname === "/raskroy" || pathname === "/raskroy/index.html";

  if (isRaskroyRoute) {
    if (!session?.userId) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", "/raskroy");
      return NextResponse.redirect(loginUrl);
    }
    if (!session.roleCode || !canAccessAdmin(session.roleCode)) {
      return NextResponse.redirect(new URL("/account", request.url));
    }
  }

  if ((isAccountRoute || isAdminRoute) && !session?.userId) {
    const next = getSafeRedirectPath(`${pathname}${search}`, "/account");
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && session?.roleCode) {
    if (!canAccessAdmin(session.roleCode)) {
      return NextResponse.redirect(new URL("/account", request.url));
    }

    if (!canAccessAdminPath(session.roleCode, pathname)) {
      return NextResponse.redirect(
        new URL(getAdminHomePath(session.roleCode), request.url),
      );
    }
  }

  // Login/register pages validate current database access before redirecting.
  // A signed cookie can still belong to a blocked or deleted account.
  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*", "/login", "/register", "/raskroy", "/raskroy/index.html"],
};

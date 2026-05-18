import { NextResponse, type NextRequest } from "next/server";

import { getSafeRedirectPath } from "@/lib/auth/redirects";
import {
  canAccessAdmin,
  canAccessAdminRoute,
  getAdminFallbackPath,
} from "@/lib/auth/roles";
import { decryptSession, sessionCookieName } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionToken = request.cookies.get(sessionCookieName)?.value;
  const session = await decryptSession(sessionToken);

  const isLoginRoute = pathname === "/login";
  const isRegisterRoute = pathname === "/register";
  const isAccountRoute = pathname.startsWith("/account");
  const isAdminRoute = pathname.startsWith("/admin");

  if ((isAccountRoute || isAdminRoute) && !session?.userId) {
    const next = getSafeRedirectPath(`${pathname}${search}`, "/account");
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && session?.roleCode && !canAccessAdmin(session.roleCode)) {
    return NextResponse.redirect(new URL("/account", request.url));
  }

  if (
    isAdminRoute &&
    session?.roleCode &&
    !canAccessAdminRoute(session.roleCode, pathname)
  ) {
    return NextResponse.redirect(
      new URL(getAdminFallbackPath(session.roleCode), request.url),
    );
  }

  if ((isLoginRoute || isRegisterRoute) && session?.userId) {
    return NextResponse.redirect(
      new URL(
        canAccessAdmin(session.roleCode) ? "/admin" : "/account",
        request.url,
      ),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*", "/login", "/register"],
};

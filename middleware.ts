
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/constants";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isProtectedPage = pathname.startsWith("/documents");

  const hasAuthCookie = Boolean(
    request.cookies.get(AUTH_COOKIE_NAME)?.value
  );
  if (isProtectedPage && !hasAuthCookie) {
    const loginUrl = new URL("/login", request.url);

    loginUrl.searchParams.set(
      "callbackUrl",
      `${pathname}${search}`
    );

    return NextResponse.redirect(loginUrl);
  }

  if (
    (pathname === "/login" || pathname === "/register") &&
    hasAuthCookie
  ) {
    const callbackUrl =
      request.nextUrl.searchParams.get("callbackUrl");

    const redirectUrl = new URL(
      callbackUrl || "/documents",
      request.url
    );

    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/documents/:path*",
    "/login",
    "/register",
  ],
};
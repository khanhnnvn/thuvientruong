import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Tenant session cookie's VALUE is the slug it belongs to (not just a flag),
// so we can detect "logged into a different school" and force a re-login.
const TENANT_SESSION_COOKIE = "lib_session";
// Super admin session is a completely separate cookie/store from any tenant session.
const SUPER_ADMIN_SESSION_COOKIE = "sa_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public, non-tenant routes.
  if (pathname === "/" || pathname === "/dang-ky" || pathname.startsWith("/dang-ky/")) {
    return NextResponse.next();
  }

  // Super admin area: separate session, own login page.
  if (pathname === "/super-admin/login" || pathname.startsWith("/super-admin/login/")) {
    if (request.cookies.has(SUPER_ADMIN_SESSION_COOKIE)) {
      return NextResponse.redirect(new URL("/super-admin", request.url));
    }
    return NextResponse.next();
  }
  if (pathname === "/super-admin" || pathname.startsWith("/super-admin/")) {
    if (!request.cookies.has(SUPER_ADMIN_SESSION_COOKIE)) {
      return NextResponse.redirect(new URL("/super-admin/login", request.url));
    }
    return NextResponse.next();
  }

  // Everything else is /:slug/... (a school's own login page or app pages).
  const segments = pathname.split("/").filter(Boolean);
  const slug = segments[0];
  if (!slug) return NextResponse.next();

  const isLoginPath = segments[1] === "login";
  const sessionSlug = request.cookies.get(TENANT_SESSION_COOKIE)?.value;
  // A session cookie scoped to a different slug counts as "not logged in here".
  const isAuthenticatedForSlug = Boolean(sessionSlug) && sessionSlug === slug;

  if (!isAuthenticatedForSlug && !isLoginPath) {
    const loginUrl = new URL(`/${slug}/login`, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticatedForSlug && isLoginPath) {
    return NextResponse.redirect(new URL(`/${slug}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

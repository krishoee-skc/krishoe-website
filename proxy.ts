import { NextResponse, type NextRequest } from "next/server";
import {
  canAdmin,
  getSessionAdminRole,
  type AdminPermission,
} from "@/lib/admin-role-permissions";
import { adminSessionCookieName, verifyAdminSessionToken } from "@/lib/admin-session";
import { customerSessionCookieName, verifyCustomerSessionToken } from "@/lib/customer-session";
import { safeAdminNextPath, safeCustomerNextPath } from "@/lib/safe-redirect";

function isProtectedApi(pathname: string) {
  return (
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/orders") ||
    pathname.startsWith("/api/messages") ||
    pathname.startsWith("/api/products")
  );
}

function adminApiPermission(pathname: string): AdminPermission | null {
  const routePath = pathname.replace(/\/+$/, "") || "/";

  if (routePath === "/api/admin/backup") return "backup:export";
  if (routePath === "/api/admin/readiness") return "readiness:read";
  if (routePath === "/api/admin/notifications/deliver") return "notifications:write";
  if (routePath === "/api/products/export") return "exports:read";
  if (routePath === "/api/orders/export") return "exports:read";
  if (routePath === "/api/messages/export") return "exports:read";
  if (routePath === "/api/products") return "products:write";
  if (routePath === "/api/orders") return "orders:write";
  if (routePath === "/api/messages") return "messages:write";
  if (routePath.startsWith("/api/admin/pos/") && (routePath.endsWith("/barcode") || routePath.endsWith("/qr"))) {
    return "pos:write";
  }
  if (routePath.startsWith("/api/admin/") && routePath.endsWith("/export")) return "exports:read";

  return null;
}

function isProtectedAdmin(pathname: string) {
  return pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");
}

function isCustomerAuthPage(pathname: string) {
  return (
    pathname.startsWith("/account/login") ||
    pathname.startsWith("/account/register") ||
    pathname.startsWith("/account/reset-password")
  );
}

function isProtectedAccount(pathname: string) {
  return pathname === "/account" || (pathname.startsWith("/account/") && !isCustomerAuthPage(pathname));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get(adminSessionCookieName)?.value;
  const adminSession = await verifyAdminSessionToken(token);
  const hasValidSession = Boolean(adminSession);
  const customerToken = request.cookies.get(customerSessionCookieName)?.value;
  const hasCustomerSession = Boolean(await verifyCustomerSessionToken(customerToken));

  if (pathname.startsWith("/admin/login") && hasValidSession) {
    return NextResponse.redirect(new URL(safeAdminNextPath(request.nextUrl.searchParams.get("next")), request.url));
  }

  if (isProtectedApi(pathname) && !hasValidSession) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiPermission = adminApiPermission(pathname);

  if (apiPermission && adminSession && !canAdmin(getSessionAdminRole(adminSession), apiPermission)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (isProtectedAdmin(pathname) && !hasValidSession) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isCustomerAuthPage(pathname) && hasCustomerSession) {
    return NextResponse.redirect(new URL(safeCustomerNextPath(request.nextUrl.searchParams.get("next")), request.url));
  }

  if (isProtectedAccount(pathname) && !hasCustomerSession) {
    const loginUrl = new URL("/account/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/orders/:path*",
    "/api/messages/:path*",
    "/api/products/:path*",
    "/account",
    "/account/:path*",
  ],
};

import { NextResponse, type NextRequest } from "next/server";
import {
  canAdmin,
  getAdminPagePermission,
  getSessionAdminRole,
  type AdminPermission,
} from "@/lib/admin-role-permissions";
import { adminSessionCookieName, verifyAdminSessionToken } from "@/lib/admin-session";
import { customerSessionCookieName, verifyCustomerSessionToken } from "@/lib/customer-session";
import { canAccessFactoryApi, getFactoryApiPolicy } from "@/lib/factory-api-policy";
import { safeCustomerNextPath } from "@/lib/safe-redirect";

function isProtectedApi(pathname: string) {
  return (
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/factory") ||
    pathname.startsWith("/api/orders") ||
    pathname.startsWith("/api/messages") ||
    pathname.startsWith("/api/products") ||
    pathname.startsWith("/api/worker")
  );
}

function adminApiPermission(pathname: string, method: string): AdminPermission | null {
  const routePath = pathname.replace(/\/+$/, "") || "/";
  const writeRequest = !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());

  if (routePath === "/api/admin/backup") return "backup:export";
  if (routePath === "/api/admin/readiness") return "readiness:read";
  if (routePath === "/api/admin/notifications/deliver") return "notifications:write";
  if (routePath === "/api/products/export") return "exports:read";
  if (routePath === "/api/orders/export") return "exports:read";
  if (routePath === "/api/messages/export") return "exports:read";
  if (routePath === "/api/products") return writeRequest ? "products:write" : "products:read";
  if (routePath === "/api/orders") return writeRequest ? "orders:write" : "orders:read";
  if (routePath === "/api/messages") return writeRequest ? "messages:write" : "messages:read";
  if (routePath.startsWith("/api/admin/pos/") && (routePath.endsWith("/barcode") || routePath.endsWith("/qr"))) {
    return "pos:write";
  }
  if (routePath.startsWith("/api/admin/") && routePath.endsWith("/export")) return "exports:read";

  return null;
}

function isAdminAuthPage(pathname: string) {
  return (
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/admin/forgot-password") ||
    pathname.startsWith("/admin/reset-password") ||
    pathname.startsWith("/admin/accept-invite")
  );
}

function isProtectedAdmin(pathname: string) {
  return pathname.startsWith("/admin") && !isAdminAuthPage(pathname);
}

function isProtectedWorker(pathname: string) {
  return pathname.startsWith("/worker") && !pathname.startsWith("/worker/login");
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

  if (isProtectedApi(pathname) && !hasValidSession) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isProtectedApi(pathname) && adminSession?.mustChangePassword) {
    return Response.json({ error: "Password change required" }, { status: 403 });
  }

  if (pathname.startsWith("/api/factory") && adminSession) {
    const factoryPolicy = getFactoryApiPolicy(pathname, request.method);
    const role = getSessionAdminRole(adminSession);

    if (!factoryPolicy || !canAccessFactoryApi(role, factoryPolicy)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const apiPermission = adminApiPermission(pathname, request.method);

  if (apiPermission && adminSession && !canAdmin(getSessionAdminRole(adminSession), apiPermission)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (isProtectedAdmin(pathname) && !hasValidSession) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isProtectedWorker(pathname) && !hasValidSession) {
    return NextResponse.redirect(new URL("/worker/login", request.url));
  }

  if (pathname.startsWith("/worker/login") && hasValidSession) {
    return NextResponse.redirect(new URL("/worker/dashboard", request.url));
  }

  if (isProtectedWorker(pathname) && adminSession?.mustChangePassword) {
    return NextResponse.redirect(new URL("/admin/change-password", request.url));
  }

  if (
    isProtectedAdmin(pathname) &&
    adminSession?.mustChangePassword &&
    !pathname.startsWith("/admin/change-password")
  ) {
    return NextResponse.redirect(new URL("/admin/change-password", request.url));
  }

  const pagePermission = getAdminPagePermission(pathname);
  if (
    isProtectedAdmin(pathname) &&
    adminSession &&
    pagePermission &&
    !canAdmin(getSessionAdminRole(adminSession), pagePermission)
  ) {
    return NextResponse.redirect(new URL("/admin/forbidden", request.url));
  }

  if (
    isProtectedAdmin(pathname) &&
    adminSession &&
    getSessionAdminRole(adminSession) === "Factory" &&
    !pathname.startsWith("/admin/factory")
  ) {
    return NextResponse.redirect(new URL("/admin/factory", request.url));
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
    "/api/factory/:path*",
    "/api/orders/:path*",
    "/api/messages/:path*",
    "/api/products/:path*",
    "/account",
    "/account/:path*",
    "/worker/:path*",
    "/api/worker/:path*",
  ],
};

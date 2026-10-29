const localBaseUrl = "https://krishoe.local";

function safeRelativePath(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const url = new URL(value, localBaseUrl);

    if (url.origin !== localBaseUrl) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

function isCustomerAuthPath(pathname: string) {
  return (
    pathname.startsWith("/account/login") ||
    pathname.startsWith("/account/register") ||
    pathname.startsWith("/account/reset-password") ||
    pathname.startsWith("/account/verify-email")
  );
}

export function safeCustomerNextPath(value: string | null | undefined) {
  const nextPath = safeRelativePath(value, "/account");
  const pathname = new URL(nextPath, localBaseUrl).pathname;

  if (pathname.startsWith("/api") || pathname.startsWith("/admin") || isCustomerAuthPath(pathname)) {
    return "/account";
  }

  return nextPath;
}

/**
 * Where a sign-in lands when it was not sent from a page: Home, the day's
 * work as large buttons (owner, 2026-10-29, "home ma pugne banaunu"). A Factory
 * login is sent on to the factory by proxy.ts.
 */
export const ADMIN_HOME = "/admin/hub/home";

export function safeAdminNextPath(value: string | null | undefined) {
  const nextPath = safeRelativePath(value, ADMIN_HOME);
  const pathname = new URL(nextPath, localBaseUrl).pathname;

  if (
    !pathname.startsWith("/admin") ||
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/admin/forgot-password") ||
    pathname.startsWith("/admin/reset-password") ||
    pathname.startsWith("/admin/accept-invite")
  ) {
    return ADMIN_HOME;
  }

  return nextPath;
}

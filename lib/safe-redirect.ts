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
    pathname.startsWith("/account/reset-password")
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

export function safeAdminNextPath(value: string | null | undefined) {
  const nextPath = safeRelativePath(value, "/admin");
  const pathname = new URL(nextPath, localBaseUrl).pathname;

  if (!pathname.startsWith("/admin") || pathname.startsWith("/admin/login")) {
    return "/admin";
  }

  return nextPath;
}

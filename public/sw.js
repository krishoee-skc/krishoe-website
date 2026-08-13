const CACHE_NAME = "krishoe-shell-v2";
const RUNTIME_CACHE = "krishoe-public-assets-v2";
const OFFLINE_URL = "/offline";
const SHELL_ASSETS = [OFFLINE_URL];

const PRIVATE_PATH_PREFIXES = [
  "/api",
  "/admin",
  "/account",
  "/checkout",
  "/customer",
  "/order",
  "/worker",
];

function isPrivatePath(pathname) {
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isPublicStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/icons/") ||
    /\.(?:avif|css|gif|ico|jpe?g|png|svg|webp|woff2?)$/i.test(pathname)
  );
}

function canCache(response) {
  const cacheControl = response.headers.get("cache-control") || "";
  return (
    response.ok &&
    response.type === "basic" &&
    !/\b(?:no-store|private)\b/i.test(cacheControl) &&
    !response.headers.has("set-cookie")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => caches.delete(name)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Authenticated, personal and API responses must never enter Cache Storage.
  if (isPrivatePath(url.pathname)) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(
        () => new Response("Network connection required", { status: 503 }),
      ),
    );
    return;
  }

  // Public pages stay network-authoritative; only the generic offline page is cached.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL);
        return offline || new Response("Offline", { status: 503 });
      }),
    );
    return;
  }

  if (!isPublicStaticAsset(url.pathname)) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;

      const response = await fetch(request);
      if (canCache(response)) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    }),
  );
});

self.addEventListener("push", (event) => {
  const options = {
    badge: "/badge.png",
    vibrate: [200, 100, 200],
  };

  if (event.data) {
    try {
      const data = event.data.json();
      options.title = data.title || "KRISHOE";
      options.body = data.body || "New notification";
    } catch {
      options.title = "KRISHOE";
      options.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(options.title || "KRISHOE", options),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("/");
      }
    }),
  );
});

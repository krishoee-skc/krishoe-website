type KeyFactory = () => string;
type KeyStorage = Pick<Storage, "getItem" | "setItem">;
const STORAGE_PREFIX = "krishoe:factory:idempotency:";

function fallbackUuid() {
  const bytes = new Uint8Array(16);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? fallbackUuid();
}

export function createIdempotencyKeyRegistry(
  createKey: KeyFactory = createIdempotencyKey,
  providedStorage?: KeyStorage | null,
) {
  const keys = new Map<string, string>();

  function storage() {
    if (providedStorage !== undefined) return providedStorage;
    if (typeof window === "undefined") return null;

    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }

  function read(scope: string) {
    try {
      return storage()?.getItem(`${STORAGE_PREFIX}${scope}`) || null;
    } catch {
      return null;
    }
  }

  function write(scope: string, key: string) {
    try {
      storage()?.setItem(`${STORAGE_PREFIX}${scope}`, key);
    } catch {
      // A private-mode/storage failure must not stop the Factory save itself.
    }
  }

  return {
    get(scope: string) {
      const existing = keys.get(scope);
      if (existing) return existing;

      const persisted = read(scope);
      if (persisted) {
        keys.set(scope, persisted);
        return persisted;
      }

      const key = createKey();
      keys.set(scope, key);
      write(scope, key);
      return key;
    },
    rotate(scope: string) {
      const key = createKey();
      keys.set(scope, key);
      write(scope, key);
      return key;
    },
  };
}

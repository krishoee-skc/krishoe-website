import crypto from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  analyticsConfigured,
  buildAssertion,
  fetchAnalyticsSnapshot,
  readAnalyticsConfig,
} from "@/lib/google-analytics";

/**
 * The admin dashboard reads Google Analytics through a service account.
 *
 * Everything that can go wrong here goes wrong the same way — Google answers
 * "unauthorized" — so the failures are indistinguishable from the outside.
 * These tests separate them: a key that was pasted with escaped newlines, a
 * measurement id used where a property id belongs, and a truncated JSON file
 * each get their own named refusal rather than one shrug.
 */

let privateKey: string;

beforeAll(() => {
  // A real RSA key, generated here, so the signature path is exercised for
  // real rather than mocked into agreeing with itself.
  privateKey = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  }).privateKey;
});

const keyJson = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    client_email: "krishoe-reader@krishoe.iam.gserviceaccount.com",
    private_key: privateKey,
    ...overrides,
  });

describe("reading the analytics config", () => {
  it("accepts a well-formed service account key", () => {
    const result = readAnalyticsConfig({
      GA4_PROPERTY_ID: "512345678",
      GA_SERVICE_ACCOUNT_KEY: keyJson(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.propertyId).toBe("512345678");
    expect(result.config.clientEmail).toBe("krishoe-reader@krishoe.iam.gserviceaccount.com");
  });

  /**
   * The single most likely way this breaks in production.
   *
   * A PEM is multi-line. Pasted into a hosting dashboard it frequently arrives
   * with the newlines stored as the two characters backslash-n, and signing
   * with that fails inside OpenSSL with a message that never mentions newlines.
   */
  it("repairs a private key whose newlines were escaped in transit", () => {
    const escaped = privateKey.replace(/\n/g, "\\n");
    const result = readAnalyticsConfig({
      GA4_PROPERTY_ID: "512345678",
      GA_SERVICE_ACCOUNT_KEY: `{"client_email":"a@b.iam.gserviceaccount.com","private_key":"${escaped}"}`,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.privateKey).toContain("\n");
    expect(result.config.privateKey).not.toContain("\\n");
    // Proof it is usable, not merely well-shaped.
    expect(() => buildAssertion(result.config, 1_700_000_000)).not.toThrow();
  });

  it("names the measurement id when it is used as the property id", () => {
    const result = readAnalyticsConfig({
      GA4_PROPERTY_ID: "G-GQ6KLH97N4",
      GA_SERVICE_ACCOUNT_KEY: keyJson(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The G- id is the one the owner has seen, on every page of the site; the
    // Data API wants the numeric property id, which looks nothing like it.
    expect(result.reason).toContain("G-");
    expect(result.reason).toContain("अंकमात्र");
  });

  it("says which value is missing rather than failing as a whole", () => {
    const noKey = readAnalyticsConfig({ GA4_PROPERTY_ID: "512345678" });
    expect(noKey.ok).toBe(false);
    if (!noKey.ok) expect(noKey.reason).toContain("GA_SERVICE_ACCOUNT_KEY");

    const noProperty = readAnalyticsConfig({
      GA_SERVICE_ACCOUNT_KEY: keyJson(),
    });
    expect(noProperty.ok).toBe(false);
    if (!noProperty.ok) expect(noProperty.reason).toContain("GA4_PROPERTY_ID");
  });

  it("rejects a truncated key file instead of signing with half of one", () => {
    const result = readAnalyticsConfig({
      GA4_PROPERTY_ID: "512345678",
      GA_SERVICE_ACCOUNT_KEY: '{"client_email":"a@b.com"}',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("private_key");
  });

  it("rejects text that is not JSON at all", () => {
    const result = readAnalyticsConfig({
      GA4_PROPERTY_ID: "512345678",
      GA_SERVICE_ACCOUNT_KEY: "krishoe-reader@krishoe.iam.gserviceaccount.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("JSON");
  });

  it("treats padding-only values as unset", () => {
    // Same trap the sitemap and the reset links hit: a value pasted into a
    // hosting dashboard arrives carrying a trailing newline.
    expect(
      analyticsConfigured({
        GA4_PROPERTY_ID: "  \n",
        GA_SERVICE_ACCOUNT_KEY: " ",
      }),
    ).toBe(false);
  });
});

describe("the token assertion", () => {
  it("is signed with the service account key and verifies against it", () => {
    const config = {
      propertyId: "512345678",
      clientEmail: "krishoe-reader@krishoe.iam.gserviceaccount.com",
      privateKey,
    };
    const assertion = buildAssertion(config, 1_700_000_000);
    const [header, claims, signature] = assertion.split(".");

    expect(
      crypto
        .createVerify("RSA-SHA256")
        .update(`${header}.${claims}`)
        .verify(
          crypto.createPublicKey(privateKey).export({ type: "spki", format: "pem" }),
          Buffer.from(signature, "base64url"),
        ),
    ).toBe(true);
  });

  it("asks Google for read-only access and nothing more", () => {
    const assertion = buildAssertion(
      { propertyId: "1", clientEmail: "a@b.iam.gserviceaccount.com", privateKey },
      1_700_000_000,
    );
    const claims = JSON.parse(
      Buffer.from(assertion.split(".")[1], "base64url").toString("utf8"),
    ) as { scope: string; exp: number; iat: number; iss: string };

    // The whole safety argument for putting this key in the deployment is that
    // it can only read one GA property. A widened scope would quietly undo it.
    expect(claims.scope).toBe("https://www.googleapis.com/auth/analytics.readonly");
    expect(claims.iss).toBe("a@b.iam.gserviceaccount.com");
    expect(claims.exp - claims.iat).toBe(3600);
  });

  it("is base64url, carrying no characters that would break the form post", () => {
    const assertion = buildAssertion(
      { propertyId: "1", clientEmail: "a@b.iam.gserviceaccount.com", privateKey },
      1_700_000_000,
    );
    expect(assertion).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });
});

describe("the snapshot when nothing is configured", () => {
  it("comes back as a value, so an unconfigured admin page still renders", async () => {
    const result = await fetchAnalyticsSnapshot(28, {});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // `configured: false` is what tells the dashboard to show setup steps
    // rather than "Google is down".
    expect(result.configured).toBe(false);
    expect(result.reason).toContain("GA4_PROPERTY_ID");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

type QrOptions = { bcid: string; text: string };

const requireAdminPermission = vi.fn();
const toSVG = vi.fn((options: QrOptions) => `<svg data-text="${options.text}"/>`);

function encodedOptions(): QrOptions {
  const call = toSVG.mock.calls[0];
  if (!call) throw new Error("the QR route never rendered a barcode");
  return call[0];
}

vi.mock("@/lib/admin-permissions", () => ({
  requireAdminPermission: (...args: unknown[]) => requireAdminPermission(...args),
}));
vi.mock("bwip-js/node", () => ({ default: { toSVG: (options: QrOptions) => toSVG(options) } }));

beforeEach(() => {
  requireAdminPermission.mockReset().mockResolvedValue(undefined);
  toSVG.mockClear();
  process.env.NEXT_PUBLIC_SITE_URL = "https://krishoe-website.vercel.app\n";
  vi.resetModules();
});

async function callRoute() {
  const { GET } = await import("@/app/api/admin/hr/worker-portal-qr/route");
  return GET();
}

describe("worker portal QR", () => {
  it("requires a factory permission before rendering anything", async () => {
    await callRoute();
    // Was hr:write. The HR module holds no attendance or payroll and the portal
    // reads the factory tables, so the people who print this poster are the
    // ones running the factory floor.
    expect(requireAdminPermission).toHaveBeenCalledWith("production:entry");
  });

  it("encodes the worker login URL", async () => {
    await callRoute();
    expect(encodedOptions()).toMatchObject({
      bcid: "qrcode",
      text: "https://krishoe-website.vercel.app/worker/login",
    });
  });

  // A printed poster cannot be corrected after the fact, so the encoded URL
  // must survive an env value that carries stray whitespace.
  it("encodes no whitespace even when the site URL env has a trailing newline", async () => {
    await callRoute();
    expect(encodedOptions().text).not.toMatch(/\s/);
  });

  // Hundreds of people will scan this. Anything secret in it is secret from
  // nobody, so the payload must stay a plain public URL.
  it("carries no credentials or worker identity", async () => {
    await callRoute();
    const { text } = encodedOptions();
    expect(text).toBe("https://krishoe-website.vercel.app/worker/login");
    expect(text).not.toMatch(/token|password|secret|[?&]/i);
  });

  it("serves an SVG that is not cached", async () => {
    const response = await callRoute();
    expect(response.headers.get("Content-Type")).toContain("image/svg+xml");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});

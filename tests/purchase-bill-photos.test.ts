import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const blob = vi.hoisted(() => ({ put: vi.fn(), list: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", () => blob);

const { deleteBillPhoto, isBillId, listBillPhotos, saveBillPhoto } = await import("@/lib/purchase-photos");

/**
 * A photo of the supplier's paper bill, kept in the file store and found by
 * the bill's own id — nothing added to the database.
 */

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  blob.put.mockResolvedValue({ url: "https://store/x.jpg", pathname: "purchase-photos/PUR-1-photo-abc.jpg" });
});

describe("a bill's photos", () => {
  it("are named after the bill, with a part nobody can guess", async () => {
    await saveBillPhoto("PUR-20260925-AB12", Buffer.from("x"), "image/jpeg");
    const [pathname, , options] = blob.put.mock.calls[0];
    expect(pathname).toBe("purchase-photos/PUR-20260925-AB12-photo.jpg");
    expect(options).toMatchObject({ addRandomSuffix: true });
  });

  it("are found by the bill's name only — not a bill whose id merely starts the same", async () => {
    blob.list.mockResolvedValue({ blobs: [] });
    await listBillPhotos("PUR-20260925-AB12");
    expect(blob.list.mock.calls[0][0].prefix).toBe("purchase-photos/PUR-20260925-AB12-photo");
  });

  it("can only be removed from their own bill", async () => {
    expect(await deleteBillPhoto("PUR-1", "purchase-photos/PUR-2-photo-abc.jpg")).toBe(false);
    expect(await deleteBillPhoto("PUR-1", "products/shoe.jpg")).toBe(false);
    expect(blob.del).not.toHaveBeenCalled();
    expect(await deleteBillPhoto("PUR-1", "purchase-photos/PUR-1-photo-abc.jpg")).toBe(true);
    expect(blob.del).toHaveBeenCalledWith("purchase-photos/PUR-1-photo-abc.jpg");
  });

  it("refuse an id that is not a bill id", () => {
    expect(isBillId("PUR-20260925-AB12")).toBe(true);
    expect(isBillId("../products")).toBe(false);
    expect(isBillId("a/b")).toBe(false);
  });

  it("stay quiet when the store is not set up", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect(await listBillPhotos("PUR-1")).toEqual([]);
    expect(blob.list).not.toHaveBeenCalled();
  });
});

describe("the photo route and the form", () => {
  it("needs purchasing permission, checks type and size, and caps the count", async () => {
    const route = await readFile("app/api/admin/purchasing/[id]/photos/route.ts", "utf8");
    expect(route.match(/await requireAdminPermission\("purchasing:write"\)/g)?.length).toBe(2);
    expect(route).toContain("BILL_PHOTO_TYPES.includes(file.type)");
    expect(route).toContain("file.size > MAX_BILL_PHOTO_BYTES");
    expect(route).toContain("existing.length >= MAX_BILL_PHOTOS");
    expect(route).toContain("const invoice = await getPurchaseInvoiceById(id);");
  });

  it("shrinks the photo in the browser before sending — the host refuses 4.5 MB", async () => {
    const upload = await readFile("lib/bill-photo-upload.ts", "utf8");
    expect(upload).toContain("const MAX_SIDE = 1600;");
    expect(upload).toContain('canvas.toBlob(resolve, "image/jpeg", QUALITY)');
  });

  it("sends the photos only after the bill is saved, and a failed photo never undoes the bill", async () => {
    const form = await readFile("app/admin/purchasing/_components/PurchaseInvoiceForm.tsx", "utf8");
    expect(form).toContain("const sent = await uploadBillPhoto(invoiceId, photo.file);");
    expect(form).toContain("The bill is saved — add the photo from the bill page.");
  });
});

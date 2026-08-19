import bwipjs from "bwip-js/node";
import { type NextRequest } from "next/server";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * A QR for a KRISHOE page, so a phone can open it without typing the address.
 *
 * It encodes a path and nothing else — never a token, a password or a person.
 * A QR is a signboard: everyone in the room can photograph it, so anything
 * secret in one is secret from nobody. Scanning this lands on a sign-in page
 * that was already public on the internet; the password and the emailed code
 * are what actually guard the door, and neither is in here.
 *
 * The path is checked against a fixed list rather than trusted, so a crafted
 * link cannot turn this endpoint into a QR generator for any address it likes —
 * which is how a QR on a KRISHOE screen would end up pointing somewhere else.
 */
/**
 * Every address a QR on this screen is allowed to carry.
 *
 * The role entries are not extra doors. Owner, Manager, Accountant and Viewer
 * all sign in at the same /admin/login with the same password and the same
 * emailed code; what differs is only where they are dropped afterwards, through
 * the `next` parameter the login page already accepts. A QR cannot grant a
 * role and must never look as though it can — the role lives on the account.
 *
 * `next` is validated again on arrival by safeAdminNextPath, so a value here
 * that stopped existing degrades to /admin rather than to a broken page.
 */
const ALLOWED: Record<string, string> = {
  admin: "/admin/login",
  worker: "/worker/login",
  shop: "/",
  // Same door, different room on the other side of it.
  owner: "/admin/login?next=%2Fadmin",
  manager: "/admin/login?next=%2Fadmin%2Forders",
  accountant: "/admin/login?next=%2Fadmin%2Fpayments",
  viewer: "/admin/login?next=%2Fadmin%2Fanalytics",
  factory: "/admin/login?next=%2Fadmin%2Ffactory",
};

export async function GET(request: NextRequest) {
  await requireAdminPermission("dashboard:read");

  const key = request.nextUrl.searchParams.get("to") ?? "admin";
  const path = ALLOWED[key] ?? ALLOWED.admin;

  const svg = bwipjs.toSVG({
    bcid: "qrcode",
    text: absoluteUrl(path),
    // Read off a screen at arm's length, or off paper pinned to a wall. Size is
    // the lever that keeps a scuffed print scannable.
    scale: 6,
    paddingwidth: 4,
    paddingheight: 4,
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

import bwipjs from "bwip-js/node";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { getSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * The shop's review page as a QR code, for the foot of the counter bill.
 *
 * The shop had no reviews and ten counter bills: the only ask was an email a
 * week after an online order closed, and counter customers leave no email.
 * The bill is the paper they take home, and /review is the public page built
 * to be scanned (owner, 2026-09-29). One address for every bill, so there is
 * nothing per-invoice here to leak.
 */
export async function GET() {
  await requireAdminPermission("pos:write");

  const svg = bwipjs.toSVG({
    bcid: "qrcode",
    text: `${getSiteUrl().replace(/\/$/, "")}/review`,
    scale: 4,
    paddingwidth: 4,
    paddingheight: 4,
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

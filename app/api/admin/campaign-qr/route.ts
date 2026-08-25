import bwipjs from "bwip-js/node";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { campaignPlaces, campaignSources, campaignUrl } from "@/lib/campaign-links";

export const dynamic = "force-dynamic";

/**
 * A QR for a printed flyer, carrying the tag that says where the shopper came
 * from.
 *
 * The owner asked for this: a poster in the bazaar, a camera pointed at it, and
 * for once the shop learns whether printing was worth the money. Without the
 * tag those visits arrive as "Direct" and are indistinguishable from somebody
 * typing the address, which is how print gets a reputation for not working.
 *
 * The path and source are matched against the known lists rather than trusted:
 * this route takes query parameters and returns an image, and an unvalidated
 * path would let anyone with an admin session mint a QR for any URL.
 */
export async function GET(request: Request) {
  await requireAdminPermission("insights:read");

  const params = new URL(request.url).searchParams;
  const place =
    campaignPlaces.find((entry) => entry.path === params.get("path")) ?? campaignPlaces[0];
  const source =
    campaignSources.find((entry) => entry.id === params.get("source")) ??
    campaignSources.find((entry) => entry.id === "flyer") ??
    campaignSources[0];

  const svg = bwipjs.toSVG({
    bcid: "qrcode",
    text: campaignUrl(place.path, source.id),
    // Printed on a flyer that will be handled, folded and pinned to a wall.
    // Size is the lever that keeps a scuffed code scannable.
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

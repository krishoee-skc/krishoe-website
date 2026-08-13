import bwipjs from "bwip-js/node";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

// A single QR for the worker sign-in page, sized for a printed poster on the
// factory wall. It deliberately encodes only the public login URL and no
// credentials or worker identity — hundreds of people will point a camera at
// it, and anything secret in a QR is secret from nobody.
export async function GET() {
  await requireAdminPermission("hr:write");

  const svg = bwipjs.toSVG({
    bcid: "qrcode",
    text: absoluteUrl("/worker/login"),
    // Printed large and left at the library default error correction, matching
    // the work-order QR route. A wall poster picks up scuffs, so size is the
    // lever that keeps it scannable.
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

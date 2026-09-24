import manifest from "@/lib/app-manifest";

/**
 * The shop app's manifest, served at the address app/manifest.ts used to own.
 *
 * It was a file convention (app/manifest.ts), and Next.js puts that file's
 * <link rel="manifest"> on every page with nothing able to override it — so
 * the worker portal could not name its own manifest, and a worker who added
 * the portal to the home screen got the shop app. Served from a route and
 * named in the root layout's metadata instead, the worker layout can point at
 * /worker.webmanifest. The JSON is unchanged.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(JSON.stringify(manifest()), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}

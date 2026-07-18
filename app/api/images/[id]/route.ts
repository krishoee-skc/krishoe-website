import { getDatabaseImage } from "@/lib/image-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ImageRouteContext = {
  params: Promise<{ id: string }>;
};

// Serves a product photo stored in the database. Public on purpose: the shop
// and its customers load these, exactly like any other product image URL.
// Nothing here is admin-only, so it sits outside /api/admin where the proxy
// would otherwise require a session.
export async function GET(_request: Request, { params }: ImageRouteContext) {
  const { id } = await params;
  const image = await getDatabaseImage(id);

  if (!image) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.contentType,
      // The bytes for an id never change (a new upload gets a new id), so let
      // the browser and CDN hold onto it.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

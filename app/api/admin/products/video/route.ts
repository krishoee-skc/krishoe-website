import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { VIDEO_MAX_BYTES, VIDEO_TYPES } from "@/lib/product-media";

/**
 * Lets the photos screen send a shoe's video straight from the phone to the
 * file store (owner, 2026-10-07). A video is too big to pass through the
 * shop's own server, so this only hands out a one-time permission — to a
 * signed-in staff member who may change products, for one video file, under
 * products/videos/, up to 20 MB. Saving it on the shoe is a separate step
 * (setProductVideoAction), which checks the address again.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        await requireAdminPermission("products:write");
        if (!pathname.startsWith("products/videos/")) throw new Error("Videos go under products/videos/.");
        return {
          allowedContentTypes: [...VIDEO_TYPES],
          maximumSizeInBytes: VIDEO_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Upload refused." }, { status: 400 });
  }
}

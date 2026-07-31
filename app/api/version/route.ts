import { currentDeploymentVersion } from "@/lib/deployment-version";

// The deployment currently serving requests. A page loaded from an older
// deployment polls this and, when it differs, offers a reload. Read at request
// time and never cached, so it always names the live deployment — a stale answer
// here would defeat the whole point.
//
// Public on purpose: it returns only a deployment id, nothing sensitive, and it
// sits outside /api/admin so proxy.ts does not gate it (an admin sitting on a
// stale page must still be able to learn a new one exists).
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { version: currentDeploymentVersion() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

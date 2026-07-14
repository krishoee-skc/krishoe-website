export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      app: "KRISHOE",
      ok: true,
      checkedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

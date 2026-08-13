import { NextResponse } from "next/server";

function legacyResponse() {
  return NextResponse.json(
    { error: "This legacy endpoint was replaced by /api/feedback." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST() {
  return legacyResponse();
}

export async function GET() {
  return legacyResponse();
}

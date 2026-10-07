import { NextResponse } from "next/server";
import { getProblemPlatforms } from "@/lib/sourceStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { platforms: getProblemPlatforms() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

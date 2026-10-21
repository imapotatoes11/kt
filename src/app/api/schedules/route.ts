import { NextResponse } from "next/server";
import { hasAppAccess } from "@/lib/auth";
import { PROFILES } from "@/lib/profiles";
import { readState } from "@/lib/state-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Every profile's base timetable, for the side-by-side compare view. Only the
 * schedule is exposed — settings, exceptions, and the delivery log stay private
 * to whichever profile is loaded through /api/state.
 */
export async function GET(request: Request) {
  if (!hasAppAccess(request)) return NextResponse.json({ error: "Invalid access key" }, { status: 401 });

  const profiles = await Promise.all(PROFILES.map(async (profile) => ({
    id: profile.id,
    name: profile.name,
    schedule: (await readState(profile.id)).schedule,
  })));

  return NextResponse.json({ profiles });
}

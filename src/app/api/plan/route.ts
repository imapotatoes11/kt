import { NextResponse } from "next/server";
import { hasAppAccess } from "@/lib/auth";
import { buildPlan } from "@/lib/notifications";
import { getLocalDate, getOccurrences } from "@/lib/schedule";
import { profileIdFromRequest } from "@/lib/profiles";
import { readState } from "@/lib/state-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasAppAccess(request)) return NextResponse.json({ error: "Invalid access key" }, { status: 401 });
  const profileId = profileIdFromRequest(request);
  if (!profileId) return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  const state = await readState(profileId);
  const url = new URL(request.url);
  const days = Math.min(31, Math.max(1, Number(url.searchParams.get("days") ?? 14)));
  const firstDate = getLocalDate(state.schedule.term.timezone);
  const [plan, occurrences] = await Promise.all([
    buildPlan(state, firstDate, days, url.searchParams.get("weather") === "1", profileId),
    Promise.resolve(getOccurrences(state, firstDate, days)),
  ]);
  return NextResponse.json({ plan, occurrences });
}

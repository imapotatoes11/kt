import { NextResponse } from "next/server";
import { hasAppAccess } from "@/lib/auth";
import { isDatabaseConfigured, appName } from "@/lib/env";
import { PROFILES, profileIdFromRequest } from "@/lib/profiles";
import { scheduleSchema } from "@/lib/schema";
import { readState, writeState } from "@/lib/state-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Replaces the active profile's base timetable with an imported schedule JSON. */
export async function PUT(request: Request) {
  if (!hasAppAccess(request)) return NextResponse.json({ error: "Invalid access key" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database is not connected" }, { status: 503 });
  const profileId = profileIdFromRequest(request);
  if (!profileId) return NextResponse.json({ error: "Invalid profile" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "That is not valid JSON" }, { status: 400 });
  }
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: `Schedule rejected at ${issue.path.join(".") || "root"}: ${issue.message}` }, { status: 400 });
  }

  const current = await readState(profileId);
  const meetingIds = new Set(parsed.data.meetings.map((meeting) => meeting.id));
  const state = await writeState({
    ...current,
    schedule: parsed.data,
    exceptions: current.exceptions.filter((exception) => meetingIds.has(exception.meetingId)),
  }, profileId);
  return NextResponse.json({ ...state, profileId, database: true, profiles: PROFILES, appName: appName(), deliveryLog: state.deliveryLog.slice(-50).reverse() });
}

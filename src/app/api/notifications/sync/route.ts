import { NextResponse } from "next/server";
import { hasAppAccess } from "@/lib/auth";
import { syncNotificationSchedule } from "@/lib/notification-sync";
import { isDatabaseConfigured } from "@/lib/env";
import { profileIdFromRequest } from "@/lib/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!hasAppAccess(request)) return NextResponse.json({ error: "Invalid access key" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database is not connected" }, { status: 503 });
  const profileId = profileIdFromRequest(request);
  if (!profileId) return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  const result = await syncNotificationSchedule(profileId);
  return NextResponse.json(result);
}

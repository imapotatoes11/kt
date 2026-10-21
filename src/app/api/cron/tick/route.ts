import { NextResponse } from "next/server";
import { hasCronAccess } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/env";
import { syncAllNotificationSchedules } from "@/lib/notification-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!hasCronAccess(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ ok: true, skipped: "Database is not connected" });
  const result = await syncAllNotificationSchedules();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

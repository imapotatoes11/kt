import { NextResponse } from "next/server";
import { hasAppAccess } from "@/lib/auth";
import { publishNtfy } from "@/lib/notifications";
import { appName, isDatabaseConfigured } from "@/lib/env";
import { profileIdFromRequest } from "@/lib/profiles";
import { readState, writeState } from "@/lib/state-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasAppAccess(request)) return NextResponse.json({ error: "Invalid access key" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database is not connected" }, { status: 503 });
  const profileId = profileIdFromRequest(request);
  if (!profileId) return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  const state = await readState(profileId);
  const sentAt = new Date().toISOString();
  const notification = {
    title: `${appName()} notifications are connected`,
    message: "This is a test from your timetable tracker. You are ready for the next class.",
  };

  try {
    await publishNtfy(state, notification);
    await writeState({
      ...state,
      deliveryLog: [...state.deliveryLog, { id: `test:${sentAt}`, sentAt, ...notification, status: "sent" as const }].slice(-250),
    }, profileId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ntfy error";
    await writeState({
      ...state,
      deliveryLog: [...state.deliveryLog, { id: `test:${sentAt}`, sentAt, ...notification, status: "failed" as const, error: message }].slice(-250),
    }, profileId);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

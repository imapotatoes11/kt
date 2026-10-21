import { NextResponse } from "next/server";
import { createSessionToken, hasAppAccess, hasNoAccessKeys, isLoginBlocked, isValidAppKey, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { mutableStateSchema } from "@/lib/schema";
import { appName, isDatabaseConfigured } from "@/lib/env";
import { PROFILES, profileIdFromRequest } from "@/lib/profiles";
import { readState, writeState } from "@/lib/state-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (isLoginBlocked(request)) return NextResponse.json({ error: "Too many failed attempts. Try again in a few minutes." }, { status: 429 });
  if (!hasAppAccess(request)) {
    const error = hasNoAccessKeys() ? "No access key is configured. Set APP_ACCESS_KEY in the environment." : "Invalid access key";
    return NextResponse.json({ error }, { status: 401 });
  }
  const profileId = profileIdFromRequest(request);
  if (!profileId) return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  const state = await readState(profileId);
  const response = NextResponse.json({
    ...state,
    profileId,
    deliveryLog: state.deliveryLog.slice(-50).reverse(),
    database: isDatabaseConfigured(),
    profiles: PROFILES,
    appName: appName(),
  });
  const headerKey = request.headers.get("x-app-key") ?? "";
  if (headerKey && isValidAppKey(headerKey)) {
    response.cookies.set(SESSION_COOKIE, createSessionToken(headerKey), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
  }
  return response;
}

export async function PUT(request: Request) {
  if (!hasAppAccess(request)) return NextResponse.json({ error: "Invalid access key" }, { status: 401 });
  const profileId = profileIdFromRequest(request);
  if (!profileId) return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database is not connected" }, { status: 503 });
  const current = await readState(profileId);
  const parsed = mutableStateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the highlighted settings", issues: parsed.error.flatten() }, { status: 400 });
  }
  const state = await writeState({
    ...current,
    settings: parsed.data.settings,
    exceptions: parsed.data.exceptions,
    superReminders: parsed.data.superReminders,
  }, profileId);
  return NextResponse.json({ ...state, profileId, database: true, profiles: PROFILES, appName: appName(), deliveryLog: state.deliveryLog.slice(-50).reverse() });
}

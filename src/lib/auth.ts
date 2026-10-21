import { timingSafeEqual } from "node:crypto";
import { configuredAccessKeys } from "./env";

export const SESSION_COOKIE = "timetable_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isValidAppKey(candidate: string) {
  const developmentKeys = process.env.NODE_ENV === "development" ? ["timetable"] : [];
  return [...configuredAccessKeys(), ...developmentKeys].some((expected) => safeEqual(candidate, expected));
}

/** True when no key can ever match, so sign-in should explain the setup step. */
export function hasNoAccessKeys() {
  return process.env.NODE_ENV !== "development" && configuredAccessKeys().length === 0;
}

export function hasAppAccess(request: Request) {
  const headerKey = request.headers.get("x-app-key") ?? "";
  if (headerKey && isValidAppKey(headerKey)) return true;
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))?.[1];
  return cookie ? isValidAppKey(decodeURIComponent(cookie)) : false;
}

export function hasCronAccess(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && safeEqual(request.headers.get("authorization") ?? "", `Bearer ${cronSecret}`)) return true;
  return hasAppAccess(request);
}

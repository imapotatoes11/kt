import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { configuredAccessKeys } from "./env";

export const SESSION_COOKIE = "timetable_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const MAX_FAILED_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function validKeys() {
  return [...configuredAccessKeys(), ...(process.env.NODE_ENV === "development" ? ["timetable"] : [])];
}

export function isValidAppKey(candidate: string) {
  return validKeys().some((expected) => safeEqual(candidate, expected));
}

/** True when no key can ever match, so sign-in should explain the setup step. */
export function hasNoAccessKeys() {
  return process.env.NODE_ENV !== "development" && configuredAccessKeys().length === 0;
}

/**
 * Signing secret for session cookies. `SESSION_SECRET` should be set in any real
 * deployment; without it a secret is derived from the configured access keys,
 * so sessions still never contain a key but cannot be signed independently.
 */
function sessionSecret() {
  const explicit = process.env.SESSION_SECRET?.trim();
  return explicit || createHash("sha256").update(`timetable-session:${validKeys().join("\n")}`).digest("hex");
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

/** Short fingerprint of an access key, so rotating or removing a key ends its sessions. */
function keyFingerprint(key: string) {
  return createHmac("sha256", sessionSecret()).update(`key:${key}`).digest("hex").slice(0, 16);
}

/** A signed, expiring session token. It carries a key fingerprint, never the key. */
export function createSessionToken(key: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ exp: now + SESSION_MAX_AGE * 1000, k: keyFingerprint(key) })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string, now = Date.now()) {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined || !safeEqual(signature, sign(payload))) return false;
  try {
    const { exp, k } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown; k?: unknown };
    return typeof exp === "number" && exp > now && typeof k === "string" && validKeys().some((key) => safeEqual(k, keyFingerprint(key)));
  } catch {
    return false;
  }
}

// Failed sign-ins per client address. In-memory, so on serverless hosting it
// is per instance — a speed bump against guessing, not a hard guarantee.
const failures = new Map<string, { count: number; resetAt: number }>();

function clientAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export function isLoginBlocked(request: Request, now = Date.now()) {
  const entry = failures.get(clientAddress(request));
  return Boolean(entry && entry.resetAt > now && entry.count >= MAX_FAILED_ATTEMPTS);
}

function recordFailure(request: Request, now = Date.now()) {
  const address = clientAddress(request);
  const entry = failures.get(address);
  if (!entry || entry.resetAt <= now) failures.set(address, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
  else entry.count += 1;
  if (failures.size > 5000) for (const [key, value] of failures) if (value.resetAt <= now) failures.delete(key);
}

export function hasAppAccess(request: Request) {
  const headerKey = request.headers.get("x-app-key") ?? "";
  if (headerKey) {
    if (isLoginBlocked(request)) return false;
    if (isValidAppKey(headerKey)) return true;
    recordFailure(request);
    return false;
  }
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))?.[1];
  return cookie ? verifySessionToken(decodeURIComponent(cookie)) : false;
}

export function hasCronAccess(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && safeEqual(request.headers.get("authorization") ?? "", `Bearer ${cronSecret}`)) return true;
  return hasAppAccess(request);
}

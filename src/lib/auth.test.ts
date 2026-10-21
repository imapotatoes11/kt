import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, hasAppAccess, isLoginBlocked, SESSION_MAX_AGE, verifySessionToken } from "./auth";

const request = (headers: Record<string, string> = {}) => new Request("http://localhost/api/state", { headers });

describe("session tokens", () => {
  beforeEach(() => {
    vi.stubEnv("APP_ACCESS_KEY", "correct horse");
    vi.stubEnv("SESSION_SECRET", "test-secret");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("never contains the access key and verifies until it expires", () => {
    const token = createSessionToken("correct horse", 1_000);
    expect(token).not.toContain("correct");
    expect(Buffer.from(token.split(".")[0], "base64url").toString()).not.toContain("correct");
    expect(verifySessionToken(token, 2_000)).toBe(true);
    expect(verifySessionToken(token, 1_000 + SESSION_MAX_AGE * 1000 + 1)).toBe(false);
  });

  it("rejects a tampered token and one for a key that was rotated away", () => {
    const token = createSessionToken("correct horse");
    expect(verifySessionToken(`${token}x`)).toBe(false);
    expect(verifySessionToken(`${token.split(".")[0]}.AAAA`)).toBe(false);
    vi.stubEnv("APP_ACCESS_KEY", "a different key");
    expect(verifySessionToken(token)).toBe(false);
  });

  it("accepts a valid cookie, and blocks an address after repeated wrong keys", () => {
    const cookie = `timetable_session=${encodeURIComponent(createSessionToken("correct horse"))}`;
    expect(hasAppAccess(request({ cookie }))).toBe(true);

    const attacker = { "x-forwarded-for": "203.0.113.9", "x-app-key": "wrong" };
    for (let attempt = 0; attempt < 10; attempt += 1) expect(hasAppAccess(request(attacker))).toBe(false);
    expect(isLoginBlocked(request(attacker))).toBe(true);
    expect(hasAppAccess(request({ ...attacker, "x-app-key": "correct horse" }))).toBe(false);
  });
});

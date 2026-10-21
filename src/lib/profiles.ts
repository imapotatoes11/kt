import type { Profile, ProfileId } from "./types";

/**
 * Profiles come from `APP_PROFILES`, a comma-separated list of `id:Name` pairs
 * (for example `alex:Alex,sam:Sam Lee`). IDs are lowercased and must be
 * URL-safe; the name is optional and defaults to the ID. With nothing set there
 * is a single profile, `me`.
 */
function parseProfiles(raw: string | undefined): Profile[] {
  const seen = new Set<string>();
  const profiles: Profile[] = [];
  for (const entry of (raw ?? "").split(",")) {
    const [rawId, ...rest] = entry.split(":");
    const id = rawId?.trim().toLowerCase();
    if (!id || !/^[a-z0-9_-]{1,40}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    profiles.push({ id, name: rest.join(":").trim() || id });
  }
  return profiles.length ? profiles : [{ id: "me", name: "Me" }];
}

export const PROFILES: readonly Profile[] = parseProfiles(process.env.APP_PROFILES);

export const PROFILE_IDS: ProfileId[] = PROFILES.map((profile) => profile.id);

export const DEFAULT_PROFILE_ID: ProfileId = PROFILE_IDS[0];

export function isProfileId(value: unknown): value is ProfileId {
  return typeof value === "string" && PROFILE_IDS.includes(value);
}

export function profileIdFromRequest(request: Request): ProfileId | null {
  const value = new URL(request.url).searchParams.get("profile") ?? DEFAULT_PROFILE_ID;
  return isProfileId(value) ? value : null;
}

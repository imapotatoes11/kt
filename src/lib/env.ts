/** Single place that reads deployment configuration from the environment. */

export function appName() {
  return process.env.APP_NAME?.trim() || "Timetable";
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function configuredAccessKeys() {
  return [process.env.APP_ACCESS_KEY, ...(process.env.APP_ACCESS_KEYS?.split(",") ?? [])]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function number(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  return raw?.trim() && Number.isFinite(value) ? value : fallback;
}

/** Defaults for the first-trip origin, overridable per deployment. */
export function defaultWalkingOrigin() {
  return {
    originLabel: process.env.DEFAULT_ORIGIN_LABEL?.trim() || "Campus entrance",
    originLatitude: number(process.env.DEFAULT_ORIGIN_LATITUDE, 43.6532),
    originLongitude: number(process.env.DEFAULT_ORIGIN_LONGITUDE, -79.3832),
  };
}

export function defaultTimezone() {
  return process.env.DEFAULT_TIMEZONE?.trim() || "America/Toronto";
}

export function defaultNtfyServer() {
  return process.env.NTFY_SERVER?.trim() || "https://ntfy.sh";
}

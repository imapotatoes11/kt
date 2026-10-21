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

/**
 * Defaults for the first-trip origin. Left unset (null) unless the deployment
 * configures one, so nobody silently inherits somebody else's city.
 */
export function defaultWalkingOrigin() {
  const latitude = number(process.env.DEFAULT_ORIGIN_LATITUDE, Number.NaN);
  const longitude = number(process.env.DEFAULT_ORIGIN_LONGITUDE, Number.NaN);
  const configured = Number.isFinite(latitude) && Number.isFinite(longitude);
  return {
    originLabel: configured ? process.env.DEFAULT_ORIGIN_LABEL?.trim() || "Home" : "",
    originLatitude: configured ? latitude : null,
    originLongitude: configured ? longitude : null,
  };
}

export function defaultTimezone() {
  return process.env.DEFAULT_TIMEZONE?.trim() || "UTC";
}

export function defaultNtfyServer() {
  return process.env.NTFY_SERVER?.trim() || "https://ntfy.sh";
}

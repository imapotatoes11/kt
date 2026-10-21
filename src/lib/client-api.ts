import type { AppState, Occurrence, PlannedNotification, Profile, ProfileId, Schedule } from "./types";

export interface ClientState extends AppState {
  /** False until DATABASE_URL points at a Neon database; saving is disabled until then. */
  database: boolean;
  profiles: Profile[];
  appName: string;
  profileId: ProfileId;
}

function profilePath(path: string, profileId: ProfileId) {
  if (!profileId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}profile=${encodeURIComponent(profileId)}`;
}

async function request<T>(path: string, key: string, init?: RequestInit): Promise<T> {
  const headers = { "Content-Type": "application/json", ...init?.headers } as Record<string, string>;
  if (key) headers["x-app-key"] = key;
  const response = await fetch(path, {
    ...init,
    headers,
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}

export function loadState(key: string, profileId: ProfileId) {
  return request<ClientState>(profilePath("/api/state", profileId), key, { cache: "no-store" });
}

export function saveState(key: string, profileId: ProfileId, state: AppState) {
  return request<ClientState>(profilePath("/api/state", profileId), key, {
    method: "PUT",
    body: JSON.stringify({ settings: state.settings, exceptions: state.exceptions, superReminders: state.superReminders }),
  });
}

export function importSchedule(key: string, profileId: ProfileId, schedule: unknown) {
  return request<ClientState>(profilePath("/api/schedule", profileId), key, { method: "PUT", body: JSON.stringify(schedule) });
}

export function loadPlan(key: string, profileId: ProfileId) {
  return request<{ plan: PlannedNotification[]; occurrences: Occurrence[] }>(profilePath("/api/plan?days=14&weather=1", profileId), key, { cache: "no-store" });
}

export interface ProfileSchedule extends Profile {
  schedule: Schedule;
}

export function loadSchedules(key: string) {
  return request<{ profiles: ProfileSchedule[] }>("/api/schedules", key, { cache: "no-store" });
}

export function sendTest(key: string, profileId: ProfileId) {
  return request<{ ok: true }>(profilePath("/api/notifications/test", profileId), key, { method: "POST", body: "{}" });
}

export function syncNotifications(key: string, profileId: ProfileId) {
  return request<{ ok: boolean; scheduled: number; cancelled: number; failed: number; reason?: string }>(profilePath("/api/notifications/sync", profileId), key, {
    method: "POST",
    body: "{}",
  });
}

export function logoutSession() {
  return fetch("/api/auth/logout", { method: "POST" });
}

import { neon } from "@neondatabase/serverless";
import { createDefaultState } from "./defaults";
import { isDatabaseConfigured } from "./env";
import { DEFAULT_PROFILE_ID } from "./profiles";
import type { AppState, ProfileId } from "./types";

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("Database is not connected. Set DATABASE_URL to a Neon connection string.");
  }
}

let ready: Promise<ReturnType<typeof neon>> | null = null;

/** Opens the Neon connection and creates the table on first use. */
function database() {
  if (!isDatabaseConfigured()) throw new DatabaseNotConfiguredError();
  ready ??= (async () => {
    const sql = neon(process.env.DATABASE_URL!.trim());
    await sql`CREATE TABLE IF NOT EXISTS profile_state (
      profile_id text PRIMARY KEY,
      state jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
    return sql;
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

export function normalizeState(state: AppState | undefined, profileId: ProfileId): AppState {
  const defaults = createDefaultState(profileId);
  if (!state) return defaults;
  const schedule = state.schedule ?? defaults.schedule;
  const meetingIds = new Set(schedule.meetings.map((meeting) => meeting.id));
  return {
    ...defaults,
    ...state,
    schedule,
    settings: {
      ...defaults.settings,
      ...state.settings,
      ntfy: { ...defaults.settings.ntfy, ...state.settings?.ntfy },
      notifications: {
        ...defaults.settings.notifications,
        ...state.settings?.notifications,
        // Rules are stored as a whole array, so a field added later has to be
        // backfilled here rather than by the spread above.
        rules: (state.settings?.notifications?.rules ?? defaults.settings.notifications.rules)
          .map((rule) => ({ ...rule, uoftTime: rule.uoftTime ?? false })),
      },
      walking: { ...defaults.settings.walking, ...state.settings?.walking },
      display: { ...defaults.settings.display, ...state.settings?.display },
    },
    // Drop any temporary change that points at a meeting the current schedule
    // no longer has — a course dropped from the timetable, say. Otherwise it
    // lingers forever, rendering as a bare id instead of a course.
    exceptions: (state.exceptions ?? []).filter((exception) => meetingIds.has(exception.meetingId)),
    superReminders: state.superReminders ?? [],
    scheduledNotifications: state.scheduledNotifications ?? [],
    deliveryLog: state.deliveryLog ?? [],
  };
}

/** Without a database, reads return a blank default state and writes throw. */
export async function readState(profileId: ProfileId = DEFAULT_PROFILE_ID): Promise<AppState> {
  if (!isDatabaseConfigured()) return createDefaultState(profileId);
  const sql = await database();
  const rows = await sql`SELECT state FROM profile_state WHERE profile_id = ${profileId}` as Array<{ state: AppState }>;
  return normalizeState(rows[0]?.state, profileId);
}

export async function writeState(state: AppState, profileId: ProfileId = DEFAULT_PROFILE_ID) {
  const sql = await database();
  const next = { ...state, updatedAt: new Date().toISOString() };
  await sql`INSERT INTO profile_state (profile_id, state, updated_at)
    VALUES (${profileId}, ${JSON.stringify(next)}::jsonb, now())
    ON CONFLICT (profile_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`;
  return next;
}

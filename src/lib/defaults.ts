import settings from "../../data/default-settings.json";
import { defaultNtfyServer, defaultTimezone, defaultWalkingOrigin } from "./env";
import { DEFAULT_PROFILE_ID } from "./profiles";
import type { AppState, ProfileId, Schedule, Settings } from "./types";

/** What a profile has before a timetable is imported: no courses, no meetings. */
export function emptySchedule(): Schedule {
  const year = new Date().getUTCFullYear();
  return {
    term: { id: "unset", name: "No timetable yet", timezone: defaultTimezone(), startsOn: `${year}-01-01`, endsOn: `${year}-12-31`, closedRanges: [] },
    source: { label: "Not imported", accurateAsOf: `${year}-01-01`, file: "" },
    courses: [],
    buildings: [],
    meetings: [],
  };
}

export function createDefaultState(profileId: ProfileId = DEFAULT_PROFILE_ID): AppState {
  const nextSettings = structuredClone(settings) as Settings;
  nextSettings.ntfy.server = defaultNtfyServer();
  Object.assign(nextSettings.walking, defaultWalkingOrigin());
  const profileTopic = process.env[`NTFY_TOPIC_${profileId.toUpperCase().replace(/-/g, "_")}`];
  const fallbackTopic = profileId === DEFAULT_PROFILE_ID ? process.env.NTFY_TOPIC : undefined;
  if (profileTopic ?? fallbackTopic) nextSettings.ntfy.topic = profileTopic ?? fallbackTopic ?? "";

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    schedule: emptySchedule(),
    settings: nextSettings,
    exceptions: [],
    superReminders: [],
    scheduledNotifications: [],
    deliveryLog: [],
  };
}

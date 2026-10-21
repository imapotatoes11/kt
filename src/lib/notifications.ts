import { addMinutes, subMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { formatClock, getOccurrences, getPreviousOccurrence, UOFT_TIME_OFFSET_MINUTES } from "./schedule";
import { getWeather } from "./weather";
import type { AppState, Occurrence, PlannedNotification, ProfileId, SuperReminderOffset, WeatherSnapshot } from "./types";

export function stableSequenceId(occurrenceId: string, ruleId: string, profileId?: ProfileId) {
  const source = profileId ? `${profileId}:${occurrenceId}:${ruleId}` : `${occurrenceId}:${ruleId}`;
  let hash = 5381;
  for (const character of source) hash = ((hash << 5) + hash) ^ character.charCodeAt(0);
  const suffix = (hash >>> 0).toString(36);
  const slug = source.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `tt-${slug.slice(0, 52 - suffix.length)}-${suffix}`;
}

export function superReminderInstant(date: string, time: string, timezone: string) {
  return fromZonedTime(`${date}T${time}:00`, timezone);
}

export function superReminderOffsetLabel(minutes: SuperReminderOffset) {
  if (minutes >= 60) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `${minutes} minutes`;
}

export function buildSuperReminderPlan(state: AppState, profileId?: ProfileId): PlannedNotification[] {
  const timezone = state.schedule.term.timezone;
  const clock = state.settings.display.clock;

  return state.superReminders.flatMap((reminder) => {
    const eventAt = superReminderInstant(reminder.date, reminder.time, timezone);
    const eventLabel = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      weekday: "long",
      month: "short",
      day: "numeric",
    }).format(eventAt);

    return reminder.offsets.map((offset) => {
      const due = subMinutes(eventAt, offset);
      const lead = superReminderOffsetLabel(offset);
      return {
        id: `super:${reminder.id}:${offset}:${due.toISOString()}`,
        sequenceId: stableSequenceId(`super-${reminder.id}`, `before-${offset}`, profileId),
        dueAt: due.toISOString(),
        kind: "super-reminder" as const,
        title: reminder.title,
        message: `In ${lead} · ${eventLabel} at ${formatClock(eventAt.toISOString(), timezone, clock)}`,
        occurrenceId: `super:${reminder.id}`,
      };
    });
  }).sort((left, right) => left.dueAt.localeCompare(right.dueAt));
}

function haversineMeters(aLat: number, aLon: number, bLat: number, bLon: number) {
  const radius = 6_371_000;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = toRadians(bLat - aLat);
  const dLon = toRadians(bLon - aLon);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function weatherPenalty(state: AppState, weather: WeatherSnapshot | null) {
  if (!weather) return 0;
  const { walking } = state.settings;
  let penalty = 0;
  if (weather.weatherCode >= 71 && weather.weatherCode <= 86) penalty += walking.snowPenaltyMinutes;
  else if (weather.precipitationProbability >= walking.precipitationThreshold) penalty += walking.rainPenaltyMinutes;
  if (weather.temperature <= 0) penalty += walking.coldPenaltyMinutes;
  return penalty;
}

function walkOrigin(state: AppState, occurrence: Occurrence, all: Occurrence[]) {
  const previous = getPreviousOccurrence(occurrence, all);
  if (previous?.building.latitude != null && previous.building.longitude != null) {
    return {
      label: `${previous.building.code} ${previous.room}`,
      latitude: previous.building.latitude,
      longitude: previous.building.longitude,
    };
  }
  return {
    label: state.settings.walking.originLabel,
    latitude: state.settings.walking.originLatitude,
    longitude: state.settings.walking.originLongitude,
  };
}

export function baseWalkMinutes(state: AppState, occurrence: Occurrence, all: Occurrence[]) {
  const { walking } = state.settings;
  const origin = walkOrigin(state, occurrence, all);
  if (occurrence.building.latitude == null || occurrence.building.longitude == null) {
    return { minutes: 5 + walking.doorBufferMinutes, origin: origin.label };
  }
  const distance = haversineMeters(origin.latitude, origin.longitude, occurrence.building.latitude, occurrence.building.longitude);
  const travel = Math.max(1, Math.ceil(distance * walking.routeMultiplier / walking.metersPerMinute));
  return { minutes: travel + walking.doorBufferMinutes, origin: origin.label };
}

function weatherCopy(weather: WeatherSnapshot | null) {
  if (!weather) return "Weather unavailable";
  return `${weather.label}, ${weather.temperature}°C · ${weather.precipitationProbability}% precipitation`;
}

export async function buildPlan(
  state: AppState,
  firstDate: string,
  days: number,
  includeWeather = false,
  profileId?: ProfileId,
): Promise<PlannedNotification[]> {
  const all = getOccurrences(state, firstDate, days).filter((item) => !item.cancelled);
  const plan: PlannedNotification[] = [];
  const weatherRequests = new Map<string, Promise<WeatherSnapshot | null>>();

  if (includeWeather && state.settings.notifications.rules.some((item) => item.enabled && item.kind === "leave" && item.includeWeather)) {
    for (const occurrence of all) {
      if (occurrence.building.latitude != null && occurrence.building.longitude != null) {
        weatherRequests.set(
          occurrence.id,
          getWeather(occurrence.building.latitude, occurrence.building.longitude, new Date(occurrence.start), state.schedule.term.timezone),
        );
      }
    }
  }

  for (const occurrence of all) {
    for (const rule of state.settings.notifications.rules.filter((item) => item.enabled)) {
      let due: Date;
      let title = rule.label;
      let message = `${occurrence.course.code} · ${occurrence.section} · ${occurrence.building.code} ${occurrence.room}`;
      let weather: WeatherSnapshot | null = null;
      let walkMinutes: number | undefined;

      // Per-rule UofT time: aim at the real start (posted + 10 min) instead of the
      // posted one. End-of-class rules are unaffected, so they ignore the flag.
      const usesUoftTime = rule.uoftTime && rule.kind !== "before-end";
      const startsAt = usesUoftTime
        ? addMinutes(new Date(occurrence.start), UOFT_TIME_OFFSET_MINUTES)
        : new Date(occurrence.start);

      if (rule.kind === "leave") {
        const walk = baseWalkMinutes(state, occurrence, all);
        if (rule.includeWeather) weather = await weatherRequests.get(occurrence.id) ?? null;
        walkMinutes = walk.minutes + weatherPenalty(state, weather);
        due = subMinutes(startsAt, walkMinutes + rule.minutes);
        title = `Leave for ${occurrence.course.code.replace(" F", "")}`;
        message = `${walkMinutes} min from ${walk.origin} · ${occurrence.building.code} ${occurrence.room} at ${formatClock(startsAt.toISOString(), state.schedule.term.timezone, state.settings.display.clock)}`;
        if (rule.includeWeather) message += `\n${weatherCopy(weather)}`;
      } else if (rule.kind === "before-start") {
        due = subMinutes(startsAt, rule.minutes);
        title = rule.label.replace(/class/i, occurrence.course.code.replace(" F", ""));
      } else {
        due = subMinutes(new Date(occurrence.end), rule.minutes);
        title = rule.label;
        message = `${occurrence.course.code} ends at ${formatClock(occurrence.end, state.schedule.term.timezone, state.settings.display.clock)}`;
      }

      plan.push({
        id: `${occurrence.id}:${rule.id}:${due.toISOString()}`,
        sequenceId: stableSequenceId(occurrence.id, rule.id, profileId),
        dueAt: due.toISOString(),
        kind: rule.kind,
        title,
        message,
        occurrenceId: occurrence.id,
        walkMinutes,
        weather,
      });
    }
  }

  return plan.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
}

export function isQuietTime(state: AppState, instant: Date) {
  const local = formatInTimeZone(instant, state.schedule.term.timezone, "HH:mm");
  const { quietStart, quietEnd } = state.settings.notifications;
  return quietStart > quietEnd ? local >= quietStart || local < quietEnd : local >= quietStart && local < quietEnd;
}

export async function publishNtfy(
  state: AppState,
  notification: Pick<PlannedNotification, "title" | "message">,
  options?: { sequenceId?: string; dueAt?: string },
) {
  const { server, topic, priority } = state.settings.ntfy;
  if (!topic) throw new Error("ntfy topic is not configured");
  const appUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined;
  const sequencePath = options?.sequenceId ? `/${encodeURIComponent(options.sequenceId)}` : "";
  const response = await fetch(`${server.replace(/\/$/, "")}/${encodeURIComponent(topic)}${sequencePath}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Title": notification.title,
      "Priority": String(priority),
      ...(options?.dueAt ? { "At": String(Math.floor(new Date(options.dueAt).getTime() / 1000)) } : {}),
      ...(appUrl ? { "Click": appUrl } : {}),
    },
    body: notification.message,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`ntfy returned ${response.status}`);
}

export async function cancelNtfy(server: string, topic: string, sequenceId: string) {
  const response = await fetch(`${server.replace(/\/$/, "")}/${encodeURIComponent(topic)}/${encodeURIComponent(sequenceId)}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok && response.status !== 404) throw new Error(`ntfy returned ${response.status}`);
}

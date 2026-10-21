import { buildPlan, buildSuperReminderPlan, cancelNtfy, isQuietTime, publishNtfy } from "./notifications";
import { DEFAULT_PROFILE_ID, PROFILE_IDS } from "./profiles";
import { getLocalDate } from "./schedule";
import { readState, writeState } from "./state-store";
import type { AppState, PlannedNotification, ProfileId, ScheduledNotification } from "./types";

const MIN_DELAY_MS = 10_000;
const MAX_DELAY_MS = 3 * 24 * 60 * 60 * 1_000 - 5 * 60 * 1_000;

function asScheduled(state: AppState, notification: PlannedNotification): ScheduledNotification {
  return {
    id: notification.id,
    sequenceId: notification.sequenceId,
    dueAt: notification.dueAt,
    server: state.settings.ntfy.server,
    topic: state.settings.ntfy.topic,
    priority: state.settings.ntfy.priority,
    title: notification.title,
    message: notification.message,
  };
}

function isSame(left: ScheduledNotification, right: ScheduledNotification) {
  return left.dueAt === right.dueAt
    && left.server === right.server
    && left.topic === right.topic
    && left.priority === right.priority
    && left.title === right.title
    && left.message === right.message;
}

async function cancel(notification: ScheduledNotification) {
  await cancelNtfy(notification.server, notification.topic, notification.sequenceId);
}

export interface SyncResult {
  ok: boolean;
  scheduled: number;
  cancelled: number;
  failed: number;
  reason?: string;
}

export async function syncNotificationSchedule(
  profileId: ProfileId = DEFAULT_PROFILE_ID,
  now = new Date(),
): Promise<SyncResult> {
  const state = await readState(profileId);
  const nowMs = now.getTime();
  const previous = (state.scheduledNotifications ?? []).filter((item) => new Date(item.dueAt).getTime() > nowMs + MIN_DELAY_MS);
  const plan = state.settings.notifications.enabled && state.settings.ntfy.topic
    ? [
        ...await buildPlan(state, getLocalDate(state.schedule.term.timezone, now), 4, true, profileId),
        ...buildSuperReminderPlan(state, profileId),
      ]
    : [];
  const desired = plan
    .filter((item) => {
      const delay = new Date(item.dueAt).getTime() - nowMs;
      return delay >= MIN_DELAY_MS && delay <= MAX_DELAY_MS && !isQuietTime(state, new Date(item.dueAt));
    })
    .map((item) => ({ plan: item, record: asScheduled(state, item) }));

  const desiredIds = new Set(desired.map((item) => item.record.sequenceId));
  const previousById = new Map(previous.map((item) => [item.sequenceId, item]));
  const retained: ScheduledNotification[] = [];
  const errors: string[] = [];
  let cancelled = 0;

  await Promise.all(previous.filter((item) => !desiredIds.has(item.sequenceId)).map(async (item) => {
    try {
      await cancel(item);
      cancelled += 1;
    } catch (error) {
      retained.push(item);
      errors.push(`Could not cancel ${item.sequenceId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }));

  const scheduled = await Promise.all(desired.map(async ({ plan: item, record }) => {
    const old = previousById.get(record.sequenceId);
    if (old && !isSame(old, record)) {
      try {
        await cancel(old);
        cancelled += 1;
      } catch (error) {
        retained.push(old);
        errors.push(`Could not replace ${record.sequenceId}: ${error instanceof Error ? error.message : "Unknown error"}`);
        return null;
      }
    }

    try {
      await publishNtfy(state, item, { sequenceId: item.sequenceId, dueAt: item.dueAt });
      return record;
    } catch (error) {
      if (old && isSame(old, record)) retained.push(old);
      errors.push(`Could not schedule ${record.sequenceId}: ${error instanceof Error ? error.message : "Unknown error"}`);
      return null;
    }
  }));

  const active = [...retained, ...scheduled.filter((item): item is ScheduledNotification => item !== null)]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.sequenceId === item.sequenceId) === index)
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  const sentAt = now.toISOString();
  const succeeded = scheduled.filter(Boolean).length;
  const summary = `${succeeded} scheduled · ${cancelled} cancelled`;
  await writeState({
    ...state,
    scheduledNotifications: active,
    deliveryLog: [...state.deliveryLog, {
      id: `sync:${sentAt}`,
      sentAt,
      title: errors.length ? "Notification sync needs attention" : "Notification plan synced",
      message: summary,
      status: errors.length ? "failed" as const : "scheduled" as const,
      ...(errors.length ? { error: errors.slice(0, 3).join("; ") } : {}),
    }].slice(-250),
  }, profileId);

  return {
    ok: errors.length === 0,
    scheduled: succeeded,
    cancelled,
    failed: errors.length,
    ...(!state.settings.notifications.enabled
      ? { reason: "Notifications are paused" }
      : !state.settings.ntfy.topic
        ? { reason: "ntfy topic is not configured" }
        : {}),
  };
}

export async function syncAllNotificationSchedules(now = new Date()) {
  const profiles = [];
  for (const profileId of PROFILE_IDS) {
    profiles.push({ profileId, ...await syncNotificationSchedule(profileId, now) });
  }
  return {
    ok: profiles.every((result) => result.ok),
    profiles,
    scheduled: profiles.reduce((total, result) => total + result.scheduled, 0),
    cancelled: profiles.reduce((total, result) => total + result.cancelled, 0),
    failed: profiles.reduce((total, result) => total + result.failed, 0),
  };
}

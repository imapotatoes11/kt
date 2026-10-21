import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixtureState } from "./test-fixtures";

const stateStore = vi.hoisted(() => ({
  readState: vi.fn(),
  writeState: vi.fn(async (state) => state),
}));

vi.mock("./state-store", () => stateStore);

import { syncNotificationSchedule } from "./notification-sync";
import type { AppState } from "./types";

describe("ntfy schedule sync", () => {
  beforeEach(() => {
    stateStore.readState.mockReset();
    stateStore.writeState.mockClear();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("api.open-meteo.com")) {
        return new Response(JSON.stringify({
          hourly: {
            time: [],
            temperature_2m: [],
            precipitation_probability: [],
            weather_code: [],
            wind_speed_10m: [],
          },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("{}", { status: 200 });
    }));
  });

  it("schedules a rolling window and removes cancelled classes", async () => {
    const initial = fixtureState();
    initial.settings.ntfy.topic = "private-test-topic";
    stateStore.readState.mockResolvedValueOnce(initial);

    const first = await syncNotificationSchedule("me", new Date("2026-09-08T11:00:00.000Z"));
    const written = stateStore.writeState.mock.calls[0][0] as AppState;
    expect(first.ok).toBe(true);
    expect(first.scheduled).toBeGreaterThan(0);
    expect(written.scheduledNotifications).toHaveLength(first.scheduled);
    expect(vi.mocked(fetch).mock.calls.some(([url, init]) => String(url).includes("/tt-") && init?.method === "POST")).toBe(true);

    const changed: AppState = {
      ...written,
      exceptions: [{
        id: "cancel-first-class",
        meetingId: "mat101-lec-tue",
        date: "2026-09-08",
        kind: "cancelled",
        note: "Cancelled",
        createdAt: "2026-09-08T11:01:00.000Z",
      }],
    };
    stateStore.readState.mockResolvedValueOnce(changed);
    vi.mocked(fetch).mockClear();

    const second = await syncNotificationSchedule("me", new Date("2026-09-08T11:01:00.000Z"));
    expect(second.ok).toBe(true);
    expect(second.cancelled).toBeGreaterThanOrEqual(4);
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true);
  });

  it("namespaces ntfy sequence IDs by profile", async () => {
    const state = fixtureState("sam");
    state.settings.ntfy.topic = "sam-private-topic";
    stateStore.readState.mockResolvedValueOnce(state);

    await syncNotificationSchedule("sam", new Date("2026-09-08T11:00:00.000Z"));
    const written = stateStore.writeState.mock.calls[0][0] as AppState;
    expect(stateStore.readState).toHaveBeenCalledWith("sam");
    expect(stateStore.writeState).toHaveBeenCalledWith(expect.any(Object), "sam");
    expect(written.scheduledNotifications.every((item) => item.sequenceId.startsWith("tt-sam-"))).toBe(true);
  });

  it("schedules every selected lead time for a standalone super reminder", async () => {
    const state = fixtureState();
    state.settings.ntfy.topic = "private-test-topic";
    state.settings.notifications.rules = state.settings.notifications.rules.map((rule) => ({ ...rule, enabled: false }));
    state.superReminders = [{
      id: "super-osap",
      title: "Submit OSAP documents",
      date: "2026-09-21",
      time: "15:00",
      offsets: [180, 120, 60, 30, 15, 10, 5],
      createdAt: "2026-09-21T12:00:00.000Z",
    }];
    stateStore.readState.mockResolvedValueOnce(state);

    const result = await syncNotificationSchedule("me", new Date("2026-09-21T13:00:00.000Z"));
    const written = stateStore.writeState.mock.calls[0][0] as AppState;

    expect(result).toMatchObject({ ok: true, scheduled: 7, failed: 0 });
    expect(written.scheduledNotifications).toHaveLength(7);
    expect(written.scheduledNotifications.every((item) => item.title === "Submit OSAP documents")).toBe(true);
    expect(written.scheduledNotifications.every((item) => item.sequenceId.startsWith("tt-me-super-"))).toBe(true);
  });
});

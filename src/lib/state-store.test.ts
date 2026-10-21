import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACCENTS, ACCENT_IDS } from "./accents";
import { createDefaultState } from "./defaults";
import { mutableStateSchema, scheduleSchema } from "./schema";
import { normalizeState } from "./state-store";
import { fixtureState } from "./test-fixtures";
import type { AppState } from "./types";

/** Drops the flag the way state written by an older build would not have had it. */
function withoutUoftTime<T extends { uoftTime: boolean }>(value: T) {
  const copy: Partial<T> = { ...value };
  delete copy.uoftTime;
  return copy;
}

describe("settings added after a profile was stored", () => {
  it("backfills UofT time on rules and display saved before the flag existed", () => {
    const legacy = createDefaultState("me");
    // Simulate state written by an older build: the flags simply are not there.
    legacy.settings.notifications.rules = legacy.settings.notifications.rules
      .map((rule) => withoutUoftTime(rule)) as typeof legacy.settings.notifications.rules;
    legacy.settings.display = withoutUoftTime(legacy.settings.display) as typeof legacy.settings.display;

    const migrated = normalizeState(legacy, "me");

    expect(migrated.settings.notifications.rules.map((rule) => rule.uoftTime))
      .toEqual([false, false, false, false]);
    expect(migrated.settings.display.uoftTime).toBe(false);
  });

  it("keeps an explicit UofT time choice through normalization", () => {
    const stored = createDefaultState("sam");
    stored.settings.display.uoftTime = true;
    stored.settings.notifications.rules[0].uoftTime = true;

    const migrated = normalizeState(stored, "sam");

    expect(migrated.settings.display.uoftTime).toBe(true);
    expect(migrated.settings.notifications.rules[0].uoftTime).toBe(true);
    expect(normalizeState(createDefaultState("me"), "me").settings.display.uoftTime).toBe(false);
  });

  it("backfills an empty super-reminder list for older stored profiles", () => {
    const legacy = createDefaultState("me");
    delete (legacy as Partial<AppState>).superReminders;

    expect(normalizeState(legacy, "me").superReminders).toEqual([]);
  });
});

describe("saved state validation", () => {
  it("accepts a payload whose rules predate the UofT time flag", () => {
    const state = createDefaultState("me");
    const rules = state.settings.notifications.rules.map((rule) => withoutUoftTime(rule));
    const display = withoutUoftTime(state.settings.display);

    const parsed = mutableStateSchema.safeParse({
      settings: { ...state.settings, notifications: { ...state.settings.notifications, rules }, display },
      exceptions: [],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.settings.display.uoftTime).toBe(false);
    expect(parsed.data?.settings.notifications.rules.every((rule) => rule.uoftTime === false)).toBe(true);
  });

  it("accepts valid super reminders and rejects unsupported lead times", () => {
    const state = createDefaultState("me");
    const reminder = {
      id: "super-osap",
      title: "Submit OSAP documents",
      date: "2026-09-21",
      time: "15:00",
      offsets: [180, 120, 60, 30, 15, 10, 5],
      createdAt: "2026-09-21T12:00:00.000Z",
    };

    const valid = mutableStateSchema.safeParse({ settings: state.settings, exceptions: [], superReminders: [reminder] });
    const invalid = mutableStateSchema.safeParse({ settings: state.settings, exceptions: [], superReminders: [{ ...reminder, offsets: [45] }] });

    expect(valid.success).toBe(true);
    expect(valid.data?.superReminders[0].offsets).toEqual(reminder.offsets);
    expect(invalid.success).toBe(false);
  });
});

describe("accent colour", () => {
  it("defaults to orange and survives normalization", () => {
    const seeded = createDefaultState("me");
    expect(seeded.settings.display.accent).toBe("orange");

    const chosen = createDefaultState("sam");
    chosen.settings.display.accent = "blue";
    expect(normalizeState(chosen, "sam").settings.display.accent).toBe("blue");
    expect(normalizeState(seeded, "me").settings.display.accent).toBe("orange");
  });

  it("backfills display saved before the accent existed", () => {
    const legacy = createDefaultState("me");
    const display: Partial<typeof legacy.settings.display> = { ...legacy.settings.display };
    delete display.accent;
    legacy.settings.display = display as typeof legacy.settings.display;

    expect(normalizeState(legacy, "me").settings.display.accent).toBe("orange");
  });

  it("accepts a saved payload with no accent and rejects an unknown one", () => {
    const state = createDefaultState("me");
    const display: Partial<typeof state.settings.display> = { ...state.settings.display };
    delete display.accent;

    const missing = mutableStateSchema.safeParse({ settings: { ...state.settings, display }, exceptions: [] });
    expect(missing.success).toBe(true);
    expect(missing.data?.settings.display.accent).toBe("orange");

    const bogus = mutableStateSchema.safeParse({
      settings: { ...state.settings, display: { ...state.settings.display, accent: "chartreuse" } },
      exceptions: [],
    });
    expect(bogus.success).toBe(false);
  });

  it("has a stylesheet palette for every offered accent, in both schemes", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    for (const id of ACCENT_IDS) {
      // light palette, plus a dark rule that outranks it
      expect(css, `light palette for ${id}`).toContain(`[data-accent="${id}"] {`);
      expect(css, `dark palette for ${id}`).toContain(`:root[data-theme="dark"][data-accent="${id}"]`);
      expect(css, `system-dark palette for ${id}`).toContain(`:root[data-theme="system"][data-accent="${id}"]`);
      // and a swatch-scoped descendant rule so the picker chip matches the theme
      expect(css, `dark swatch for ${id}`).toContain(`:root[data-theme="dark"] [data-accent="${id}"]`);
    }
    // every palette block defines the full set of variables it is responsible for
    for (const block of css.matchAll(/\[data-accent="[a-z]+"\][^{]*\{([^}]*)\}/g)) {
      for (const name of ["--accent:", "--accent-hover:", "--accent-ink:", "--accent-soft:", "--accent-line:", "--focus:"]) {
        expect(block[1]).toContain(name);
      }
    }
  });

  it("offers every accent the schema allows, with no duplicates", () => {
    expect(ACCENT_IDS).toEqual(["red", "orange", "yellow", "green", "blue", "purple", "pink"]);
    expect(new Set(ACCENT_IDS).size).toBe(ACCENT_IDS.length);
    expect(ACCENTS.every((accent) => accent.label.length > 0)).toBe(true);
    for (const id of ACCENT_IDS) {
      const state = createDefaultState("me");
      const parsed = mutableStateSchema.safeParse({
        settings: { ...state.settings, display: { ...state.settings.display, accent: id } },
        exceptions: [],
      });
      expect(parsed.success).toBe(true);
    }
  });
});

describe("schedule persistence", () => {
  it("keeps the imported schedule and settings through normalization", () => {
    const stored = fixtureState("sam");
    stored.settings.ntfy.topic = "sams-real-topic";

    const migrated = normalizeState(stored, "sam");

    expect(migrated.schedule).toEqual(stored.schedule);
    expect(migrated.settings.ntfy.topic).toBe("sams-real-topic");
  });

  it("starts a profile with an empty schedule", () => {
    const fresh = createDefaultState("me");
    expect(fresh.schedule.meetings).toEqual([]);
    expect(fresh.schedule.courses).toEqual([]);
  });

  it("drops a temporary change left over from a meeting the schedule no longer has", () => {
    const state = fixtureState("me");
    const survivingMeetingId = state.schedule.meetings[0].id;
    state.exceptions = [
      { id: "orphan", meetingId: "a-meeting-that-was-removed", date: "2026-09-10", kind: "cancelled", note: "", createdAt: "2026-09-01T00:00:00.000Z" },
      { id: "kept", meetingId: survivingMeetingId, date: "2026-09-10", kind: "cancelled", note: "still valid", createdAt: "2026-09-01T00:00:00.000Z" },
    ];

    const migrated = normalizeState(state, "me");

    expect(migrated.exceptions).toHaveLength(1);
    expect(migrated.exceptions[0].id).toBe("kept");
  });
});

describe("schedule import validation", () => {
  it("accepts a well-formed schedule", () => {
    expect(scheduleSchema.safeParse(fixtureState().schedule).success).toBe(true);
  });

  it("rejects a meeting that references an unknown course or building", () => {
    const schedule = fixtureState().schedule;
    schedule.meetings[0] = { ...schedule.meetings[0], courseId: "nope", building: "ZZ" };
    const result = scheduleSchema.safeParse(schedule);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message).join(" ")).toContain('Unknown course "nope"');
  });

  it("rejects a meeting that ends before it starts and an unknown timezone", () => {
    const schedule = fixtureState().schedule;
    schedule.meetings[0] = { ...schedule.meetings[0], startsAt: "11:00", endsAt: "10:00" };
    expect(scheduleSchema.safeParse(schedule).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...fixtureState().schedule, term: { ...fixtureState().schedule.term, timezone: "Mars/Base" } }).success).toBe(false);
  });
});

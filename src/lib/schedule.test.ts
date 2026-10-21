import { describe, expect, it } from "vitest";
import { buildPlan, stableSequenceId } from "./notifications";
import {
  applyUoftTime,
  formatDayLabel,
  getDayRange,
  getLocalMoment,
  getOccurrences,
  getSharedFreeWindows,
  getWeekDates,
  getWeeklyGaps,
  getWeekExceptions,
  getWeekTimeline,
  shiftClock,
  UOFT_TIME_OFFSET_MINUTES,
} from "./schedule";
import { createDefaultState as createEmptyState } from "./defaults";
import { fixtureState } from "./test-fixtures";

describe("day labels", () => {
  it("calls out a class on the next local calendar day as tomorrow", () => {
    const now = new Date("2026-09-09T03:30:00.000Z");

    expect(formatDayLabel("2026-09-09T14:00:00.000Z", "America/Toronto", now)).toBe("Tomorrow");
  });

  it("keeps same-day classes labeled today", () => {
    const now = new Date("2026-09-09T14:00:00.000Z");

    expect(formatDayLabel("2026-09-09T22:00:00.000Z", "America/Toronto", now)).toBe("Today");
  });

  it("finds the schedule-local date, weekday, and time across a UTC date boundary", () => {
    const moment = getLocalMoment("America/Toronto", new Date("2026-09-21T03:30:00.000Z"));

    expect(moment).toEqual({ date: "2026-09-20", day: 0, minutes: 23 * 60 + 30 });
  });
});

describe("schedule occurrences", () => {
  it("matches the two classes on the first Tuesday", () => {
    const state = fixtureState();
    const classes = getOccurrences(state, "2026-09-08", 1);
    expect(classes.map((item) => [item.course.code, item.startsAt, item.endsAt, `${item.building.code} ${item.room}`])).toEqual([
      ["MAT101H5 F", "09:00", "11:00", "IB 200"],
      ["MAT101H5 F", "14:00", "15:00", "IB 235"],
    ]);
  });

  it("omits closed dates", () => {
    const state = fixtureState();
    expect(getOccurrences(state, "2026-10-12", 1)).toHaveLength(0);
    expect(getOccurrences(state, "2026-10-26", 5)).toHaveLength(0);
  });

  it("layers a cancellation without changing the base schedule", () => {
    const state = fixtureState();
    state.exceptions.push({
      id: "2026-09-08:mat101-lec-tue",
      meetingId: "mat101-lec-tue",
      date: "2026-09-08",
      kind: "cancelled",
      note: "Cancelled by instructor",
      createdAt: "2026-09-07T22:00:00.000Z",
    });
    const classes = getOccurrences(state, "2026-09-08", 1);
    expect(classes[0].cancelled).toBe(true);
    expect(state.schedule.meetings[0].startsAt).toBe("09:00");
  });

  it("creates start, end, and walking alerts for each active class", async () => {
    const state = fixtureState();
    state.settings.ntfy.topic = "test-topic";
    const plan = await buildPlan(state, "2026-09-08", 1, false);
    expect(plan).toHaveLength(8);
    expect(plan.filter((item) => item.kind === "leave")).toHaveLength(2);
    expect(plan.filter((item) => item.kind === "before-end")).toHaveLength(4);
    expect(new Set(plan.map((item) => item.sequenceId)).size).toBe(8);
  });

  it("uses stable, ntfy-safe sequence IDs for rescheduling", () => {
    const first = stableSequenceId("2026-09-08:mat101-lec-tue", "end-10");
    expect(first).toBe(stableSequenceId("2026-09-08:mat101-lec-tue", "end-10"));
    expect(first).toMatch(/^[a-z0-9_-]{1,64}$/);
    expect(first).not.toBe(stableSequenceId("2026-09-08:mat101-lec-tue", "end-5"));
  });
});

describe("weekly timeline", () => {
  it("positions every class and gap on one shared axis", () => {
    const timeline = getWeekTimeline(fixtureState().schedule);

    const tuesday = timeline.days.find((day) => day.day === 2)!;
    expect(tuesday.classes.map((entry) => [entry.courseCode, entry.startMinutes, entry.endMinutes])).toEqual([
      ["MAT101H5 F", 540, 660],
      ["MAT101H5 F", 840, 900],
    ]);
    expect(tuesday.gaps.map((gap) => [gap.minutes, gap.changesBuilding])).toEqual([[180, false]]);

    const thursday = timeline.days.find((day) => day.day === 4)!;
    expect(thursday.gaps.map((gap) => [gap.minutes, gap.changesBuilding])).toEqual([[0, true]]);
    expect(timeline.rangeStartMinutes).toBeLessThanOrEqual(9 * 60);
    expect(timeline.rangeEndMinutes).toBeGreaterThanOrEqual(15 * 60);
  });

  it("falls back to a 9-to-5 window when a day has no classes", () => {
    const state = fixtureState();
    state.schedule.meetings = [];
    const timeline = getWeekTimeline(state.schedule);
    expect(timeline.rangeStartMinutes).toBe(9 * 60);
    expect(timeline.rangeEndMinutes).toBe(17 * 60);
    expect(timeline.transitions).toBe(0);
  });
});

describe("empty profile", () => {
  it("has no occurrences before a timetable is imported", () => {
    const state = createEmptyState();
    expect(getOccurrences(state, "2026-09-08", 7)).toEqual([]);
  });
});

describe("UofT time", () => {
  it("shifts a clock string without touching the rest of the day", () => {
    expect(shiftClock("09:00", 10)).toBe("09:10");
    expect(shiftClock("09:55", 10)).toBe("10:05");
    expect(shiftClock("09:00", 0)).toBe("09:00");
  });

  it("moves occurrence starts forward and leaves ends and ids alone", () => {
    const state = fixtureState();
    const posted = getOccurrences(state, "2026-09-08", 1);
    const shifted = applyUoftTime(posted, true);

    expect(shifted.map((item) => item.startsAt)).toEqual(["09:10", "14:10"]);
    expect(shifted.map((item) => item.endsAt)).toEqual(posted.map((item) => item.endsAt));
    expect(shifted.map((item) => item.id)).toEqual(posted.map((item) => item.id));
    expect(shifted.map((item) => item.end)).toEqual(posted.map((item) => item.end));
    expect(new Date(shifted[0].start).getTime() - new Date(posted[0].start).getTime()).toBe(10 * 60_000);
  });

  it("returns the untouched array when the toggle is off", () => {
    const state = fixtureState();
    const posted = getOccurrences(state, "2026-09-08", 1);
    expect(applyUoftTime(posted, false)).toBe(posted);
  });

  it("shortens each class and lengthens the gap before it on the timeline", () => {
    const state = fixtureState();
    const posted = getWeekTimeline(state.schedule);
    const shifted = getWeekTimeline(state.schedule, UOFT_TIME_OFFSET_MINUTES);

    const tuesday = shifted.days.find((day) => day.day === 2)!;
    expect(tuesday.classes.map((entry) => [entry.startsAt, entry.startMinutes, entry.endMinutes])).toEqual([
      ["09:10", 550, 660],
      ["14:10", 850, 900],
    ]);

    const postedTuesday = posted.days.find((day) => day.day === 2)!;
    expect(postedTuesday.classMinutes - tuesday.classMinutes).toBe(20);
    expect(tuesday.gaps.map((gap) => gap.minutes)).toEqual([190]);

    // A back-to-back pair becomes a real ten-minute window.
    const thursday = shifted.days.find((day) => day.day === 4)!;
    expect(thursday.gaps.map((gap) => gap.minutes)).toEqual([10]);
  });
});

describe("comparing days across profiles", () => {
  it("spans every selected day and falls back when nobody has classes", () => {
    const tuesday = getWeekTimeline(fixtureState().schedule).days.find((day) => day.day === 2);
    const range = getDayRange([tuesday, undefined]);

    expect(range.startMinutes).toBeLessThanOrEqual(9 * 60);
    expect(range.endMinutes).toBeGreaterThanOrEqual(15 * 60);
    expect(getDayRange([undefined, undefined])).toEqual({ startMinutes: 9 * 60, endMinutes: 17 * 60 });
  });

  it("inverts the union of everyone's classes into shared free windows", () => {
    expect(getSharedFreeWindows([[540, 600], [570, 660]], 480, 720)).toEqual([[480, 540], [660, 720]]);
    expect(getSharedFreeWindows([], 540, 660)).toEqual([[540, 660]]);
    expect(getSharedFreeWindows([[540, 660]], 540, 660)).toEqual([]);
    // Zero-length blocks are not busy time.
    expect(getSharedFreeWindows([[600, 600]], 540, 660)).toEqual([[540, 660]]);
  });

  it("finds the window when two timetables are both free", () => {
    const other = fixtureState("other");
    other.schedule.meetings = other.schedule.meetings.map((meeting) => ({ ...meeting, startsAt: "12:00", endsAt: "13:00" }));
    const columns = [fixtureState(), other]
      .map((state) => getWeekTimeline(state.schedule).days.find((day) => day.day === 2));
    const range = getDayRange(columns);
    const free = getSharedFreeWindows(
      columns.flatMap((day) => (day?.classes ?? []).map((entry) => [entry.startMinutes, entry.endMinutes] as [number, number])),
      range.startMinutes,
      range.endMinutes,
    );

    // Every window must be free for both people.
    for (const [start, end] of free) {
      for (const day of columns) {
        for (const entry of day?.classes ?? []) {
          expect(entry.startMinutes >= end || entry.endMinutes <= start).toBe(true);
        }
      }
    }
    expect(free.length).toBeGreaterThan(0);
  });
});

describe("UofT time in the notification plan", () => {
  it("moves start-based alerts later and leaves end-based ones alone", async () => {
    const state = fixtureState();
    state.settings.ntfy.topic = "test-topic";
    const posted = await buildPlan(state, "2026-09-08", 1, false);

    const uoft = structuredClone(state);
    for (const rule of uoft.settings.notifications.rules) rule.uoftTime = true;
    const shifted = await buildPlan(uoft, "2026-09-08", 1, false);

    expect(shifted).toHaveLength(posted.length);
    const postedBySequence = new Map(posted.map((item) => [item.sequenceId, item]));

    for (const item of shifted) {
      const before = postedBySequence.get(item.sequenceId)!;
      const movedBy = (new Date(item.dueAt).getTime() - new Date(before.dueAt).getTime()) / 60_000;
      expect(movedBy).toBe(item.kind === "before-end" ? 0 : UOFT_TIME_OFFSET_MINUTES);
    }
  });

  it("only shifts the rules that opt in", async () => {
    const state = fixtureState();
    state.settings.ntfy.topic = "test-topic";
    const posted = await buildPlan(state, "2026-09-08", 1, false);

    const uoft = structuredClone(state);
    uoft.settings.notifications.rules.find((rule) => rule.id === "start-10")!.uoftTime = true;
    const shifted = await buildPlan(uoft, "2026-09-08", 1, false);

    const postedBySequence = new Map(posted.map((item) => [item.sequenceId, item]));
    const moved = shifted.filter((item) => item.dueAt !== postedBySequence.get(item.sequenceId)!.dueAt);
    expect(moved).toHaveLength(2); // one per class that day
    expect(new Set(moved.map((item) => item.kind))).toEqual(new Set(["before-start"]));
  });

  it("reports the UofT start time in the leave message", async () => {
    const state = fixtureState();
    state.settings.ntfy.topic = "test-topic";
    state.settings.notifications.rules = state.settings.notifications.rules
      .filter((rule) => rule.kind === "leave")
      .map((rule) => ({ ...rule, includeWeather: false, uoftTime: true }));

    const [first] = await buildPlan(state, "2026-09-08", 1, false);
    expect(first.message).toContain("9:10");
  });
});

describe("this week's exceptions on the recurring timeline", () => {
  it("finds the Monday-Friday dates of the week containing a reference instant", () => {
    // A Wednesday reference should resolve the same Monday..Friday as a
    // Saturday reference three days later, since both fall in the same week.
    const wednesday = getWeekDates("America/Toronto", new Date("2026-09-16T14:00:00.000Z"));
    expect(wednesday).toEqual({ 1: "2026-09-14", 2: "2026-09-15", 3: "2026-09-16", 4: "2026-09-17", 5: "2026-09-18" });

    const saturday = getWeekDates("America/Toronto", new Date("2026-09-19T14:00:00.000Z"));
    expect(saturday).toEqual(wednesday);

    // Sunday rolls forward to the coming week rather than recapping the one
    // that just ended, since "what's my week look like" is the more useful
    // reading of a Sunday check-in.
    const sunday = getWeekDates("America/Toronto", new Date("2026-09-20T14:00:00.000Z"));
    expect(sunday).toEqual({ 1: "2026-09-21", 2: "2026-09-22", 3: "2026-09-23", 4: "2026-09-24", 5: "2026-09-25" });
  });

  it("maps only this week's own exceptions onto their meeting, ignoring other weeks and other meetings", () => {
    const state = fixtureState();
    const meeting = state.schedule.meetings[0]; // Tuesday lecture
    const thisWeek = getWeekDates(state.schedule.term.timezone, new Date("2026-09-16T14:00:00.000Z"));

    state.exceptions = [
      // Listed *before* the correct one, so a version that forgets to check the
      // date would return this wrong-week exception first, rather than "a".
      { id: "b", meetingId: meeting.id, date: "2026-09-08", kind: "cancelled", note: "A different week, must not apply", createdAt: "2026-09-01T00:00:00.000Z" },
      { id: "a", meetingId: meeting.id, date: thisWeek[meeting.day], kind: "cancelled", note: "Prof is sick", createdAt: "2026-09-01T00:00:00.000Z" },
      { id: "c", meetingId: "not-a-real-meeting", date: thisWeek[meeting.day], kind: "cancelled", note: "orphaned", createdAt: "2026-09-01T00:00:00.000Z" },
    ];

    const found = getWeekExceptions(state.schedule, state.exceptions, state.schedule.term.timezone, new Date("2026-09-16T14:00:00.000Z"));
    expect(found.size).toBe(1);
    expect(found.get(meeting.id)?.id).toBe("a");
  });

  it("attaches the matching exception to its class on the timeline and leaves the rest untouched", () => {
    const state = fixtureState();
    const tuesdayMeetings = state.schedule.meetings.filter((meeting) => meeting.day === 2);
    const thisWeek = getWeekDates(state.schedule.term.timezone, new Date("2026-09-16T14:00:00.000Z"));

    state.exceptions = [{
      id: "moved-1", meetingId: tuesdayMeetings[0].id, date: thisWeek[2], kind: "moved",
      startsAt: "10:00", endsAt: "12:00", building: "DH", room: "2072",
      note: "Room double-booked", createdAt: "2026-09-01T00:00:00.000Z",
    }];
    const weekExceptions = getWeekExceptions(state.schedule, state.exceptions, state.schedule.term.timezone, new Date("2026-09-16T14:00:00.000Z"));
    const timeline = getWeekTimeline(state.schedule, 0, weekExceptions);
    const tuesday = timeline.days.find((day) => day.day === 2)!;

    const moved = tuesday.classes.find((entry) => entry.meetingId === tuesdayMeetings[0].id)!;
    expect(moved.exception).toEqual({ kind: "moved", note: "Room double-booked", startsAt: "10:00", endsAt: "12:00", building: "DH", room: "2072" });
    // The block itself stays put at the meeting's usual slot — only the text changes.
    expect(moved.startMinutes).toBe(9 * 60);

    const untouched = tuesday.classes.find((entry) => entry.meetingId !== tuesdayMeetings[0].id);
    expect(untouched?.exception).toBeUndefined();
  });

  it("carries only kind and note for a cancellation, never a phantom time", () => {
    const state = fixtureState();
    const meeting = state.schedule.meetings[0];
    const thisWeek = getWeekDates(state.schedule.term.timezone, new Date("2026-09-16T14:00:00.000Z"));
    state.exceptions = [{ id: "c", meetingId: meeting.id, date: thisWeek[meeting.day], kind: "cancelled", note: "", createdAt: "2026-09-01T00:00:00.000Z" }];

    const weekExceptions = getWeekExceptions(state.schedule, state.exceptions, state.schedule.term.timezone, new Date("2026-09-16T14:00:00.000Z"));
    const timeline = getWeekTimeline(state.schedule, 0, weekExceptions);
    const cancelled = timeline.days.flatMap((day) => day.classes).find((entry) => entry.meetingId === meeting.id)!;

    expect(cancelled.exception).toEqual({ kind: "cancelled", note: "" });
  });

  it("leaves every class untouched when nothing is passed, matching old callers", () => {
    const state = fixtureState();
    const timeline = getWeekTimeline(state.schedule);
    expect(timeline.days.flatMap((day) => day.classes).every((entry) => entry.exception === undefined)).toBe(true);
  });
});

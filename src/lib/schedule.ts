import { addDays, addMinutes, format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type {
  AppState,
  Building,
  DayTimeline,
  Occurrence,
  Schedule,
  ScheduleException,
  ScheduleGap,
  TimelineClass,
  TimelineGap,
  WeekTimeline,
} from "./types";

function isClosed(date: string, state: AppState) {
  return state.schedule.term.closedRanges.some((range) => date >= range.startsOn && date <= range.endsOn);
}

function dateAt(date: string, time: string, timezone: string) {
  return fromZonedTime(`${date}T${time}:00`, timezone);
}

export function getLocalDate(timezone: string, instant = new Date()) {
  return formatInTimeZone(instant, timezone, "yyyy-MM-dd");
}

/** Calendar date, weekday, and minutes past midnight in the schedule timezone. */
export function getLocalMoment(timezone: string, instant = new Date()) {
  const date = getLocalDate(timezone, instant);
  return {
    date,
    day: new Date(`${date}T12:00:00Z`).getUTCDay(),
    minutes: clockMinutes(formatInTimeZone(instant, timezone, "HH:mm")),
  };
}

export function formatClock(iso: string, timezone: string, clock: "12h" | "24h") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: clock === "12h",
  }).format(new Date(iso));
}

/**
 * Formats an "HH:mm" wall-clock time for display. It is a pure clock-face
 * conversion — no date, zone, or daylight-saving offset is involved, so a
 * timetable imported for any timezone reads the same as it was written.
 */
export function formatWallClock(value: string, clock: "12h" | "24h") {
  const [hours, minutes] = value.split(":").map(Number);
  if (clock === "24h") return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const suffix = hours < 12 ? "a.m." : "p.m.";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatDayLabel(iso: string, timezone: string, reference = new Date()) {
  const target = getLocalDate(timezone, new Date(iso));
  const today = getLocalDate(timezone, reference);
  if (target === today) return "Today";

  const tomorrow = format(addDays(parseISO(today), 1), "yyyy-MM-dd");
  if (target === tomorrow) return "Tomorrow";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function getOccurrences(state: AppState, firstDate: string, dayCount: number): Occurrence[] {
  const output: Occurrence[] = [];
  const timezone = state.schedule.term.timezone;

  for (let index = 0; index < dayCount; index += 1) {
    const date = format(addDays(parseISO(firstDate), index), "yyyy-MM-dd");
    if (date < state.schedule.term.startsOn || date > state.schedule.term.endsOn || isClosed(date, state)) continue;
    const day = new Date(`${date}T12:00:00Z`).getUTCDay();

    for (const meeting of state.schedule.meetings.filter((item) => item.day === day)) {
      const exception = state.exceptions.find((item) => item.meetingId === meeting.id && item.date === date);
      const startsAt = exception?.kind === "moved" && exception.startsAt ? exception.startsAt : meeting.startsAt;
      const endsAt = exception?.kind === "moved" && exception.endsAt ? exception.endsAt : meeting.endsAt;
      const buildingCode = exception?.kind === "moved" && exception.building ? exception.building : meeting.building;
      const building = state.schedule.buildings.find((item) => item.code === buildingCode) ?? {
        code: buildingCode,
        name: buildingCode,
        latitude: null,
        longitude: null,
      } satisfies Building;
      const course = state.schedule.courses.find((item) => item.id === meeting.courseId);
      if (!course) continue;

      output.push({
        id: `${date}:${meeting.id}`,
        date,
        meetingId: meeting.id,
        course,
        startsAt,
        endsAt,
        start: dateAt(date, startsAt, timezone).toISOString(),
        end: dateAt(date, endsAt, timezone).toISOString(),
        section: meeting.section,
        building,
        room: exception?.kind === "moved" && exception.room ? exception.room : meeting.room,
        cancelled: exception?.kind === "cancelled",
        moved: exception?.kind === "moved",
        note: exception?.note ?? "",
      });
    }
  }

  return output.sort((left, right) => left.start.localeCompare(right.start));
}

export function getUpcomingOccurrences(state: AppState, now = new Date(), dayCount = 14) {
  const localDate = getLocalDate(state.schedule.term.timezone, now);
  return getOccurrences(state, localDate, dayCount).filter((item) => new Date(item.end) > now);
}

export function getPreviousOccurrence(occurrence: Occurrence, all: Occurrence[]) {
  return all
    .filter((item) => item.date === occurrence.date && item.start < occurrence.start && !item.cancelled)
    .sort((left, right) => right.end.localeCompare(left.end))[0];
}

export function minutesBetween(start: string, end: string) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
}

function clockMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToClock(total: number) {
  const hours = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const minutes = Math.round(total % 60)
    .toString()
    .padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Delayed start: a class posted for 09:00 actually starts at 09:10 (offset 10).
 * The end time is unchanged, so the class gets shorter and the gap before it
 * longer. Every consumer opts in explicitly — `getOccurrences` and the default
 * `getWeekTimeline` stay on posted times so notifications keep their own per-rule
 * control over this.
 */

/** Shifts an "HH:MM" clock string, clamped to the day. */
export function shiftClock(value: string, minutes: number) {
  if (!minutes) return value;
  const total = Math.min(24 * 60 - 1, Math.max(0, clockMinutes(value) + minutes));
  return minutesToClock(total);
}

/**
 * Applies the start offset to already-built occurrences for display. The
 * occurrence id is untouched so notification-plan lookups still match, and a
 * class is never shifted past its own end.
 */
export function applyStartOffset(occurrences: Occurrence[], offsetMinutes: number): Occurrence[] {
  if (!offsetMinutes) return occurrences;
  return occurrences.map((occurrence) => {
    const start = addMinutes(new Date(occurrence.start), offsetMinutes);
    if (start >= new Date(occurrence.end)) return occurrence;
    return {
      ...occurrence,
      startsAt: shiftClock(occurrence.startsAt, offsetMinutes),
      start: start.toISOString(),
    };
  });
}

/**
 * The Monday-Friday calendar dates of the week containing `referenceDate`, keyed
 * by weekday number (1 = Monday … 5 = Friday) — the same numbering `Meeting.day`
 * and `DayTimeline.day` use.
 */
export function getWeekDates(timezone: string, referenceDate = new Date()): Record<number, string> {
  const today = getLocalDate(timezone, referenceDate);
  const isoDay = new Date(`${today}T12:00:00Z`).getUTCDay() || 7; // Sunday (0) -> 7
  // A Sunday check-in almost certainly means "what does the coming week look
  // like," not "recap the week that just ended" — so Sunday rolls forward to
  // tomorrow's Monday rather than back to yesterday's. Every other day still
  // resolves to the Monday of its own Monday-Friday week.
  const mondayOffset = isoDay === 7 ? 1 : 1 - isoDay;
  const monday = format(addDays(parseISO(today), mondayOffset), "yyyy-MM-dd");
  const dates: Record<number, string> = {};
  for (let day = 1; day <= 5; day += 1) dates[day] = format(addDays(parseISO(monday), day - 1), "yyyy-MM-dd");
  return dates;
}

/**
 * Which of this week's meetings has a cancellation or move landing on it, keyed
 * by meeting id. A meeting occurs at most once in a Monday-Friday week, so at
 * most one exception can apply per meeting here.
 */
export function getWeekExceptions(
  schedule: Schedule,
  exceptions: ScheduleException[],
  timezone: string,
  referenceDate = new Date(),
): Map<string, ScheduleException> {
  const weekDates = getWeekDates(timezone, referenceDate);
  const byMeeting = new Map<string, ScheduleException>();
  for (const meeting of schedule.meetings) {
    const date = weekDates[meeting.day];
    const exception = date ? exceptions.find((item) => item.meetingId === meeting.id && item.date === date) : undefined;
    if (exception) byMeeting.set(meeting.id, exception);
  }
  return byMeeting;
}

export function getWeeklyGaps(schedule: Schedule): ScheduleGap[] {
  const courses = new Map(schedule.courses.map((course) => [course.id, course]));
  const gaps: ScheduleGap[] = [];

  for (let day = 1; day <= 5; day += 1) {
    const meetings = schedule.meetings
      .filter((meeting) => meeting.day === day)
      .toSorted((left, right) => left.startsAt.localeCompare(right.startsAt));

    for (let index = 0; index < meetings.length - 1; index += 1) {
      const current = meetings[index];
      const next = meetings[index + 1];
      const currentCourse = courses.get(current.courseId);
      const nextCourse = courses.get(next.courseId);
      if (!currentCourse || !nextCourse) continue;
      gaps.push({
        id: `${day}:${current.id}:${next.id}`,
        day,
        startsAt: current.endsAt,
        endsAt: next.startsAt,
        minutes: Math.max(0, clockMinutes(next.startsAt) - clockMinutes(current.endsAt)),
        from: { courseCode: currentCourse.code, building: current.building, room: current.room },
        to: { courseCode: nextCourse.code, building: next.building, room: next.room },
      });
    }
  }

  return gaps;
}

/**
 * Builds a proportional weekly timeline: every class as a positioned block and
 * every between-class gap as its own block, sharing one time axis across the week
 * so the schedule view can draw classes and the empty space between them to scale.
 */
export function getWeekTimeline(
  schedule: Schedule,
  startOffsetMinutes = 0,
  weekExceptions?: Map<string, ScheduleException>,
): WeekTimeline {
  const courses = new Map(schedule.courses.map((course) => [course.id, course]));
  const days: DayTimeline[] = [];
  let rangeStart = Number.POSITIVE_INFINITY;
  let rangeEnd = Number.NEGATIVE_INFINITY;
  let totalClassMinutes = 0;
  let totalGapMinutes = 0;
  let longestGapMinutes = 0;
  let transitions = 0;

  for (let day = 1; day <= 5; day += 1) {
    const classes: TimelineClass[] = schedule.meetings
      .filter((meeting) => meeting.day === day)
      .map((meeting) => {
        const course = courses.get(meeting.courseId);
        if (!course) return null;
        const postedStart = clockMinutes(meeting.startsAt);
        const endMinutes = Math.max(postedStart, clockMinutes(meeting.endsAt));
        // A shifted start never runs past its own end, so a short class just collapses.
        const startMinutes = Math.min(postedStart + startOffsetMinutes, endMinutes);
        const raw = weekExceptions?.get(meeting.id);
        return {
          kind: "class" as const,
          meetingId: meeting.id,
          courseId: course.id,
          courseCode: course.code,
          courseName: course.name,
          color: course.color,
          section: meeting.section,
          building: meeting.building,
          room: meeting.room,
          startsAt: startOffsetMinutes ? minutesToClock(startMinutes) : meeting.startsAt,
          endsAt: meeting.endsAt,
          startMinutes,
          endMinutes,
          minutes: endMinutes - startMinutes,
          // The block stays positioned at the meeting's usual recurring slot
          // either way — a move is described in text, not by relocating the
          // block, so it stays findable at the time someone expects to look.
          ...(raw
            ? {
                exception: {
                  kind: raw.kind,
                  note: raw.note,
                  ...(raw.kind === "moved"
                    ? { startsAt: raw.startsAt, endsAt: raw.endsAt, building: raw.building, room: raw.room }
                    : {}),
                },
              }
            : {}),
        };
      })
      .filter((item): item is TimelineClass => item !== null)
      .sort((left, right) => left.startMinutes - right.startMinutes || left.endMinutes - right.endMinutes);

    const gaps: TimelineGap[] = [];
    let runningEnd = classes.length ? classes[0].endMinutes : 0;
    for (let index = 0; index < classes.length - 1; index += 1) {
      const current = classes[index];
      const next = classes[index + 1];
      runningEnd = Math.max(runningEnd, current.endMinutes);
      const gapMinutes = Math.max(0, next.startMinutes - runningEnd);
      gaps.push({
        kind: "gap",
        id: `${day}:${current.meetingId}:${next.meetingId}`,
        startsAt: minutesToClock(runningEnd),
        endsAt: next.startsAt,
        startMinutes: runningEnd,
        endMinutes: Math.max(runningEnd, next.startMinutes),
        minutes: gapMinutes,
        changesBuilding: current.building !== next.building,
        from: { courseCode: current.courseCode, building: current.building, room: current.room },
        to: { courseCode: next.courseCode, building: next.building, room: next.room },
      });
      transitions += 1;
      totalGapMinutes += gapMinutes;
      longestGapMinutes = Math.max(longestGapMinutes, gapMinutes);
    }

    const startMinutes = classes.length ? classes[0].startMinutes : null;
    const endMinutes = classes.length ? Math.max(...classes.map((item) => item.endMinutes)) : null;
    const classMinutes = classes.reduce((total, item) => total + item.minutes, 0);
    totalClassMinutes += classMinutes;
    if (startMinutes !== null) rangeStart = Math.min(rangeStart, startMinutes);
    if (endMinutes !== null) rangeEnd = Math.max(rangeEnd, endMinutes);

    days.push({
      day,
      classes,
      gaps,
      startMinutes,
      endMinutes,
      classMinutes,
      gapMinutes: gaps.reduce((total, item) => total + item.minutes, 0),
    });
  }

  if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd)) {
    rangeStart = 9 * 60;
    rangeEnd = 17 * 60;
  }

  return {
    days,
    rangeStartMinutes: Math.floor(rangeStart / 60) * 60,
    rangeEndMinutes: Math.ceil(rangeEnd / 60) * 60,
    totalClassMinutes,
    totalGapMinutes,
    longestGapMinutes,
    transitions,
  };
}

/**
 * Shared vertical range for a set of day columns that must line up — used when
 * comparing one weekday across profiles, where each profile has its own timeline.
 */
export function getDayRange(days: Array<DayTimeline | undefined>) {
  const starts = days.flatMap((day) => (day?.startMinutes != null ? [day.startMinutes] : []));
  const ends = days.flatMap((day) => (day?.endMinutes != null ? [day.endMinutes] : []));
  if (!starts.length || !ends.length) return { startMinutes: 9 * 60, endMinutes: 17 * 60 };
  return {
    startMinutes: Math.floor(Math.min(...starts) / 60) * 60,
    endMinutes: Math.ceil(Math.max(...ends) / 60) * 60,
  };
}

/**
 * Windows where none of the compared timetables has a class: the union of every
 * busy interval, inverted across the visible range. Merging first means
 * overlapping classes from different people collapse into a single busy block.
 */
export function getSharedFreeWindows(busyIntervals: Array<[number, number]>, rangeStart: number, rangeEnd: number) {
  const merged: Array<[number, number]> = [];
  for (const [start, end] of busyIntervals.filter(([from, to]) => to > from).sort((left, right) => left[0] - right[0])) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  const free: Array<[number, number]> = [];
  let cursor = rangeStart;
  for (const [start, end] of merged) {
    if (start > cursor) free.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < rangeEnd) free.push([cursor, rangeEnd]);
  return free;
}

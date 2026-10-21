"use client";

import { useState } from "react";
import { CalendarDays, History, Info, MapPin } from "lucide-react";
import type { ClientState } from "@/lib/client-api";
import type { Occurrence } from "@/lib/types";
import { formatClock, shiftClock, UOFT_TIME_OFFSET_MINUTES } from "@/lib/schedule";
import { ScheduleGapsView } from "./schedule-gaps-view";
import { ScheduleImport } from "./schedule-import";
import {
  badge,
  badgeConnected,
  cx,
  pageDescription,
  pageHeadingActions,
  pageStack,
  panel,
  statusBadge,
} from "./ui";

const weekdays = [
  { day: 1, label: "Monday", short: "Mon" },
  { day: 2, label: "Tuesday", short: "Tue" },
  { day: 3, label: "Wednesday", short: "Wed" },
  { day: 4, label: "Thursday", short: "Thu" },
  { day: 5, label: "Friday", short: "Fri" },
];

const scheduleViewSwitch =
  "segmented-control w-[220px] shrink-0 max-nav:w-[184px] [&_span]:min-h-10 [&_span]:grid-cols-[auto_auto] [&_span]:gap-[7px] [&_span]:normal-case [&_svg]:size-[15px]";

export function ScheduleView({ state, occurrences, onImport }: { state: ClientState; occurrences: Occurrence[]; onImport: (schedule: unknown) => Promise<void> }) {
  const [view, setView] = useState<"timeline" | "legacy">("timeline");
  const timezone = state.schedule.term.timezone;
  // Reversed so the *earliest* upcoming change wins when a meeting is altered
  // more than once inside the window.
  const changesByMeeting = new Map(occurrences.filter((item) => item.moved || item.cancelled).reverse().map((item) => [item.meetingId, item]));

  const uoftTime = state.settings.display.uoftTime;
  // A shifted start never runs past its own end.
  const displayStart = (startsAt: string, endsAt: string) => {
    if (!uoftTime) return startsAt;
    const shifted = shiftClock(startsAt, UOFT_TIME_OFFSET_MINUTES);
    return shifted < endsAt ? shifted : startsAt;
  };
  const changeDate = (date: string) => new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

  return (
    <div className={pageStack}>
      <header className={pageHeadingActions}>
        <div><p className="overline mb-[7px]">{state.schedule.term.name}</p><h1>Weekly schedule</h1><p className={pageDescription}>The base timetable is imported once; temporary changes layer on top.</p></div>
        <fieldset className={scheduleViewSwitch}>
          <legend className="sr-only">Schedule view</legend>
          <label><input type="radio" name="schedule-view" checked={view === "timeline"} onChange={() => setView("timeline")} /><span><CalendarDays aria-hidden="true" />Classes</span></label>
          <label><input type="radio" name="schedule-view" checked={view === "legacy"} onChange={() => setView("legacy")} /><span><History aria-hidden="true" />Legacy</span></label>
        </fieldset>
      </header>

      {state.schedule.meetings.length === 0 && <ScheduleImport empty onImport={onImport} />}

      {view === "legacy" ? <>
        <div className="flex min-h-[42px] items-center gap-2.5 rounded-input border border-accent-line bg-accent-soft px-3 py-[9px] text-[0.78rem] text-[color-mix(in_srgb,var(--accent)_75%,var(--ink))]"><Info aria-hidden="true" /><span>Classes run {changeDate(state.schedule.term.startsOn)}–{changeDate(state.schedule.term.endsOn)}. Closed dates are already excluded.{uoftTime ? " Start times show UofT time — 10 minutes after the posted start." : ""}</span></div>

        <section className="grid grid-cols-[repeat(5,minmax(170px,1fr))] gap-px overflow-hidden rounded-card border border-line bg-line max-wide:overflow-x-auto max-nav:grid-cols-1 max-nav:gap-2 max-nav:overflow-visible max-nav:border-0 max-nav:bg-transparent" aria-label="Weekly class schedule">
        {weekdays.map((weekday) => {
          const meetings = state.schedule.meetings.filter((item) => item.day === weekday.day).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
          return (
            <div className="min-w-0 bg-surface-subtle max-nav:overflow-hidden max-nav:rounded-card max-nav:border max-nav:border-line" key={weekday.day}>
              <header className="grid h-[58px] content-center border-b border-line bg-surface px-3 py-2.5 font-[620] max-nav:h-[52px] max-nav:grid-cols-[1fr_auto] max-nav:items-center">
                <span className="max-nav:hidden">{weekday.label}</span>
                <span className="hidden max-nav:inline">{weekday.short}</span>
                <small className="text-[0.66rem] font-[450] text-faint max-nav:text-right">{meetings.length} {meetings.length === 1 ? "class" : "classes"}</small>
              </header>
              <div className="grid min-h-[420px] content-start gap-2 p-2 max-nav:min-h-0">
                {meetings.length ? meetings.map((meeting) => {
                  const course = state.schedule.courses.find((item) => item.id === meeting.courseId)!;
                  const changed = changesByMeeting.get(meeting.id);
                  return (
                    <article className={cx("schedule-event max-nav:min-h-0 course-" + course.color, changed?.cancelled && "is-cancelled", changed?.moved && "is-moved")} key={meeting.id}>
                      <div className="flex items-center justify-between gap-1.5 text-[0.63rem] text-muted"><span>{meeting.section}</span>{changed && <span className={changed.cancelled ? statusBadge.cancelled : statusBadge.changed} title={`${changed.cancelled ? "Cancelled" : "Moved"} on ${changeDate(changed.date)}`}>{changed.cancelled ? "Cancelled" : "Moved"}</span>}</div>
                      <h2 className="mt-[9px] font-mono text-[0.82rem] font-[650] leading-[1.1]">{course.code}</h2>
                      {state.settings.display.showCourseNames && <p className="mt-1 min-h-8 text-[0.67rem] leading-[1.25] text-muted max-nav:min-h-0">{course.name}</p>}
                      <time className="mt-3 block text-[0.68rem]">
                        {changed?.moved ? <>
                          <s className="text-faint no-underline opacity-70 line-through">{formatClock(`2026-09-07T${meeting.startsAt}:00-04:00`, timezone, state.settings.display.clock)}–{formatClock(`2026-09-07T${meeting.endsAt}:00-04:00`, timezone, state.settings.display.clock)}</s>
                          {" → "}{formatClock(changed.start, timezone, state.settings.display.clock)}–{formatClock(changed.end, timezone, state.settings.display.clock)}
                        </> : <>{formatClock(`2026-09-07T${displayStart(meeting.startsAt, meeting.endsAt)}:00-04:00`, timezone, state.settings.display.clock)}–{formatClock(`2026-09-07T${meeting.endsAt}:00-04:00`, timezone, state.settings.display.clock)}</>}
                      </time>
                      <p className="mt-1 flex items-center gap-[5px] text-[0.68rem] text-muted [&_svg]:size-3">
                        <MapPin aria-hidden="true" />
                        {changed?.moved ? <>{meeting.building} {meeting.room} → {changed.building.code} {changed.room}</> : <>{meeting.building} {meeting.room}</>}
                      </p>
                      {changed?.note && <p className="mt-1.5 line-clamp-2 text-[0.63rem] italic leading-[1.3] text-muted">{changed.note}</p>}
                    </article>
                  );
                }) : <div className="grid min-h-[128px] content-center place-items-center gap-[7px] text-[0.71rem] text-faint max-nav:min-h-[76px] [&_svg]:opacity-45"><CalendarDays aria-hidden="true" /><span>No class</span></div>}
              </div>
            </div>
          );
        })}
        </section>
      </> : <ScheduleGapsView state={state} />}

      <section className={cx(panel, "flex items-center justify-between gap-5 px-5 py-[18px] max-nav:flex-col max-nav:items-start [&>div]:grid [&>div]:gap-[3px] [&_code]:text-ink [&_p]:text-[0.76rem] [&_p]:text-muted")}>
        <div><span className="overline">Source</span><strong>{state.schedule.source.label}</strong><p>Accurate as of {state.schedule.source.accurateAsOf}. Imported from the schedule JSON.</p></div>
        <span className={state.database ? badgeConnected : badge}>{state.database ? "Neon database" : "No database"}</span>
      </section>

      {state.schedule.meetings.length > 0 && <ScheduleImport empty={false} onImport={onImport} />}
    </div>
  );
}

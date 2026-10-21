"use client";

import { useEffect, useState } from "react";
import type { ClientState } from "@/lib/client-api";
import {
  formatWallClock,
  getLocalMoment,
  getWeekDates,
  getWeekExceptions,
  getWeekTimeline,
  minutesToClock,
} from "@/lib/schedule";
import { cx, panel } from "./ui";
import {
  DayTrack,
  durationLabel,
  GapLegend,
  timelineAxis,
  TimelineAxisColumn,
  weekdays,
} from "./day-timeline";

export function ScheduleGapsView({ state }: { state: ClientState }) {
  const [now, setNow] = useState<Date | null>(null);
  const timezone = state.schedule.term.timezone;
  const clock = state.settings.display.clock;
  const timeText = (value: string) => formatWallClock(value, clock);

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const initial = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  // Cancellations and moves are one-off, dated changes; the timeline shows the
  // recurring weekly template, so only the current calendar week's exceptions
  // make sense to overlay onto it.
  const weekExceptions = getWeekExceptions(state.schedule, state.exceptions, timezone, now ?? undefined);
  const timeline = getWeekTimeline(
    state.schedule,
    state.settings.display.delayedStart ? state.settings.display.startOffsetMinutes : 0,
    weekExceptions,
  );
  const { marks: hourMarks, totalHeight, offset } = timelineAxis(timeline.rangeStartMinutes, timeline.rangeEndMinutes);
  const weekDates = now ? getWeekDates(timezone, now) : undefined;
  const localNow = now ? getLocalMoment(timezone, now) : undefined;
  const dateLabel = (date: string) => new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
  const todayIsActive = Boolean(localNow
    && localNow.date >= state.schedule.term.startsOn
    && localNow.date <= state.schedule.term.endsOn
    && !state.schedule.term.closedRanges.some((range) => localNow.date >= range.startsOn && localNow.date <= range.endsOn));
  const currentTimeIsVisible = Boolean(localNow
    && localNow.minutes >= timeline.rangeStartMinutes
    && localNow.minutes <= timeline.rangeEndMinutes);

  const summary = [
    { label: "Class time", value: durationLabel(timeline.totalClassMinutes) },
    { label: "Open time", value: durationLabel(timeline.totalGapMinutes) },
    { label: "Transitions", value: String(timeline.transitions) },
    { label: "Longest gap", value: durationLabel(timeline.longestGapMinutes) },
  ];

  return (
    <section className={cx(panel, "overflow-hidden")} aria-labelledby="gap-title">
      <header className="gap-summary">
        <div>
          <p className="overline">Between classes</p>
          <h2 id="gap-title">Weekly gap map</h2>
          <p>Every class drawn to scale with the open time between them, measured from one class ending to the next beginning.{state.settings.display.delayedStart ? ` Start times are shifted ${state.settings.display.startOffsetMinutes} minutes after the posted start.` : ""}</p>
        </div>
        <dl>
          {summary.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <GapLegend showExceptions={weekExceptions.size > 0} />

      <div className="overflow-x-auto overflow-y-hidden">
        <div className="gap-timeline">
          <TimelineAxisColumn marks={hourMarks} totalHeight={totalHeight} offset={offset} timeText={timeText} />

          {weekdays.map((weekday) => {
            const day = timeline.days.find((item) => item.day === weekday.day);
            const classes = day?.classes ?? [];
            const openMinutes = day?.gapMinutes ?? 0;
            const date = weekDates?.[weekday.day];
            const isToday = Boolean(localNow && date === localNow.date);
            const currentTime = isToday && todayIsActive && currentTimeIsVisible && localNow
              ? { minutes: localNow.minutes, label: timeText(minutesToClock(localNow.minutes)) }
              : undefined;

            return (
              <section className={`gap-col${isToday ? " is-today" : ""}`} key={weekday.day} aria-labelledby={`gap-day-${weekday.day}`}>
                <header>
                  <h3 id={`gap-day-${weekday.day}`}>
                    <span className="gap-col-full">{weekday.label}</span>
                    <span className="gap-col-short">{weekday.short}</span>
                    {date && <time className="gap-col-date" dateTime={date}>{isToday ? "Today · " : ""}{dateLabel(date)}</time>}
                  </h3>
                  <span>
                    {classes.length
                      ? `${classes.length} ${classes.length === 1 ? "class" : "classes"}${openMinutes ? ` · ${durationLabel(openMinutes)} open` : ""}`
                      : "No classes"}
                  </span>
                </header>

                <DayTrack day={day} marks={hourMarks} totalHeight={totalHeight} offset={offset} timeText={timeText} currentTime={currentTime} />
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}

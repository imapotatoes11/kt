"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Columns3, Users } from "lucide-react";
import { loadSchedules, type ClientState, type ProfileSchedule } from "@/lib/client-api";
import {
  formatClock,
  getDayRange,
  getLocalMoment,
  getSharedFreeWindows,
  getWeekTimeline,
  minutesToClock,
  UOFT_TIME_OFFSET_MINUTES,
} from "@/lib/schedule";
import type { DayTimeline, ProfileId } from "@/lib/types";
import {
  DayTrack,
  durationLabel,
  GapLegend,
  timelineAxis,
  TimelineAxisColumn,
  weekdays,
} from "./day-timeline";
import { cx, emptyState, pageDescription, pageHeading, pageStack, panel, panelHeader } from "./ui";

/** Widest a column can get before the row starts scrolling instead. */
const MIN_COLUMN_PX = 168;
const AXIS_PX = 66;

const profileToggle =
  "flex min-h-10 cursor-pointer items-center gap-2 rounded-input border border-line bg-surface px-2.5 py-1.5 text-[0.78rem] font-[590] text-muted transition-[background-color,border-color,color] duration-[130ms] ease-out hover:border-line-strong has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-ink";

export function CompareView({ state, accessKey }: { state: ClientState; accessKey: string }) {
  const [profiles, setProfiles] = useState<ProfileSchedule[] | null>(null);
  const [error, setError] = useState("");
  const [day, setDay] = useState(() => {
    // Open on today when it is a weekday, otherwise on Monday.
    const today = new Date().getDay();
    return today >= 1 && today <= 5 ? today : 1;
  });
  const [selected, setSelected] = useState<ProfileId[]>([]);
  const [now, setNow] = useState<Date | null>(null);

  const timezone = state.schedule.term.timezone;
  const clock = state.settings.display.clock;
  const timeText = (value: string) => formatClock(`2026-09-07T${value}:00-04:00`, timezone, clock);
  const startOffset = state.settings.display.uoftTime ? UOFT_TIME_OFFSET_MINUTES : 0;

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const initial = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadSchedules(accessKey)
      .then((result) => {
        if (cancelled) return;
        setProfiles(result.profiles);
        setSelected(result.profiles.map((profile) => profile.id));
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not load the other timetables");
      });
    return () => { cancelled = true; };
  }, [accessKey]);

  const columns = useMemo(() => {
    if (!profiles) return [];
    return profiles
      .filter((profile) => selected.includes(profile.id))
      .map((profile) => {
        const timeline = getWeekTimeline(profile.schedule, startOffset);
        return { profile, day: timeline.days.find((item) => item.day === day) as DayTimeline | undefined };
      });
  }, [profiles, selected, day, startOffset]);

  const range = getDayRange(columns.map((column) => column.day));
  const { marks, totalHeight, offset } = timelineAxis(range.startMinutes, range.endMinutes);
  const weekday = weekdays.find((item) => item.day === day) ?? weekdays[0];
  const localNow = now ? getLocalMoment(timezone, now) : undefined;
  // Only draw the line when the picked weekday is today and the moment falls
  // inside the shared axis; each profile's own term decides whether today is
  // a class day for them.
  const currentTimeBase = localNow
    && localNow.day === day
    && localNow.minutes >= range.startMinutes
    && localNow.minutes <= range.endMinutes
    ? { minutes: localNow.minutes, label: timeText(minutesToClock(localNow.minutes)) }
    : undefined;
  const termIsActive = (term: ProfileSchedule["schedule"]["term"]) => Boolean(localNow
    && localNow.date >= term.startsOn
    && localNow.date <= term.endsOn
    && !term.closedRanges.some((closed) => localNow.date >= closed.startsOn && localNow.date <= closed.endsOn));
  // The "Now" pill goes on the leftmost column with a line; the rest get the bare line.
  const labelledColumn = currentTimeBase
    ? columns.findIndex((column) => termIsActive(column.profile.schedule.term))
    : -1;

  const freeWindows = getSharedFreeWindows(
    columns.flatMap((column) => (column.day?.classes ?? []).map((entry) => [entry.startMinutes, entry.endMinutes] as [number, number])),
    range.startMinutes,
    range.endMinutes,
  );
  const freeMinutes = freeWindows.reduce((total, [start, end]) => total + (end - start), 0);
  const longestFree = freeWindows.reduce((longest, [start, end]) => Math.max(longest, end - start), 0);
  const totalClasses = columns.reduce((total, column) => total + (column.day?.classes.length ?? 0), 0);

  function toggleProfile(id: ProfileId) {
    // Column order comes from the profile list, not from click order, so this
    // only has to track membership.
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <div className={pageStack}>
      <header className={pageHeading}>
        <div>
          <p className="overline mb-[7px]">Side by side</p>
          <h1>Compare timetables</h1>
          <p className={pageDescription}>Pick a weekday and line up everyone’s classes and gaps on one shared axis.</p>
        </div>
      </header>

      <section className={cx(panel, "overflow-hidden")} aria-labelledby="compare-controls-title">
        <header className={panelHeader}>
          <div className="flex items-center gap-[11px] [&>svg]:text-accent">
            <Users aria-hidden="true" />
            <div><p className="overline mb-[5px]">Choose</p><h2 id="compare-controls-title">Day and people</h2></div>
          </div>
        </header>
        <div className="grid gap-4 p-4">
          <fieldset className="m-0 grid min-w-0 content-start gap-1.5 border-0 p-0">
            <legend className="text-[0.75rem] font-[590] text-ink">Weekday</legend>
            <div className="segmented-control five">
              {weekdays.map((item) => (
                <label key={item.day}>
                  <input type="radio" name="compare-day" checked={day === item.day} onChange={() => setDay(item.day)} />
                  <span><span className="max-xs:hidden">{item.label}</span><span className="hidden max-xs:inline">{item.short}</span></span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="m-0 grid min-w-0 content-start gap-1.5 border-0 p-0">
            <legend className="text-[0.75rem] font-[590] text-ink">Timetables <span className="font-normal text-faint">· {columns.length} shown</span></legend>
            <div className="flex flex-wrap gap-2">
              {(profiles ?? []).map((profile) => (
                <label key={profile.id} className={profileToggle}>
                  <input
                    type="checkbox"
                    className="size-[15px]"
                    checked={selected.includes(profile.id)}
                    onChange={() => toggleProfile(profile.id)}
                  />
                  {profile.name}
                </label>
              ))}
              {!profiles && !error && <span className="text-[0.76rem] text-faint">Loading timetables…</span>}
            </div>
          </fieldset>
        </div>
      </section>

      {error ? (
        <section className={cx(panel, emptyState)}>
          <AlertCircle aria-hidden="true" />
          <h3>Could not load timetables</h3>
          <p>{error}</p>
        </section>
      ) : columns.length === 0 ? (
        <section className={cx(panel, emptyState)}>
          <Columns3 aria-hidden="true" />
          <h3>{profiles ? "Nothing selected" : "Loading timetables"}</h3>
          <p>{profiles ? "Pick at least one timetable above to compare." : "Fetching every profile’s base schedule."}</p>
        </section>
      ) : (
        <section className={cx(panel, "overflow-hidden")} aria-labelledby="compare-title">
          <header className="gap-summary">
            <div>
              <p className="overline">{weekday.label}</p>
              <h2 id="compare-title">{columns.map((column) => column.profile.name).join(" · ")}</h2>
              <p>Each column is one person’s {weekday.label}, drawn to scale on the same time axis so overlapping classes and shared gaps line up.</p>
            </div>
            <dl>
              <div><dt>Compared</dt><dd>{columns.length}</dd></div>
              <div><dt>Classes</dt><dd>{totalClasses}</dd></div>
              <div><dt>Everyone free</dt><dd>{freeMinutes ? durationLabel(freeMinutes) : "None"}</dd></div>
              <div><dt>Longest window</dt><dd>{longestFree ? durationLabel(longestFree) : "None"}</dd></div>
            </dl>
          </header>

          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 text-[0.7rem]">
            <span className="font-[590] text-muted">Everyone free</span>
            {freeWindows.length ? freeWindows.map(([start, end]) => (
              <span key={start} className="rounded-md border border-[color-mix(in_srgb,var(--success)_30%,var(--line))] bg-[color-mix(in_srgb,var(--success)_8%,var(--surface))] px-2 py-[3px] font-semibold text-success">
                {timeText(minutesToClock(start))}–{timeText(minutesToClock(end))}
              </span>
            )) : <span className="text-faint">No shared free time on this day.</span>}
          </div>

          <GapLegend />

          <div className="overflow-x-auto overflow-y-hidden">
            <div
              className="compare-timeline"
              style={{
                gridTemplateColumns: `${AXIS_PX}px repeat(${columns.length}, minmax(${MIN_COLUMN_PX}px, 1fr))`,
                minWidth: `${AXIS_PX + columns.length * MIN_COLUMN_PX}px`,
              }}
            >
              <TimelineAxisColumn marks={marks} totalHeight={totalHeight} offset={offset} timeText={timeText} />

              {columns.map(({ profile, day: dayTimeline }, index) => {
                const classes = dayTimeline?.classes ?? [];
                const openMinutes = dayTimeline?.gapMinutes ?? 0;
                return (
                  <section className="gap-col" key={profile.id} aria-labelledby={`compare-col-${profile.id}`}>
                    <header>
                      <h3 id={`compare-col-${profile.id}`}>{profile.name}</h3>
                      <span>
                        {classes.length
                          ? `${classes.length} ${classes.length === 1 ? "class" : "classes"}${openMinutes ? ` · ${durationLabel(openMinutes)} open` : ""}`
                          : "No classes"}
                      </span>
                    </header>

                    <DayTrack
                      day={dayTimeline}
                      marks={marks}
                      totalHeight={totalHeight}
                      offset={offset}
                      timeText={timeText}
                      emptyLabel={`${profile.name} has no ${weekday.label} classes.`}
                      currentTime={currentTimeBase && termIsActive(profile.schedule.term)
                        ? { ...currentTimeBase, showLabel: index === labelledColumn }
                        : undefined}
                    />
                  </section>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

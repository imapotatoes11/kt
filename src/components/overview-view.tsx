"use client";

import { useEffect, useState } from "react";
import { BellRing, CalendarClock, CalendarDays, CloudRain, CloudSun, Footprints, MapPin, Play, Snowflake, Sun } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { TextMorph } from "torph/react";
import { syncNotifications } from "@/lib/client-api";
import { formatClock, formatDayLabel } from "@/lib/schedule";
import type { ClientState } from "@/lib/client-api";
import type { Occurrence, PlannedNotification, ProfileId } from "@/lib/types";
import type { ViewId } from "./app-shell";
import {
  button,
  compactEmpty,
  cx,
  emptyState,
  pageHeading,
  pageStack,
  panel,
  panelHeader,
  textButton,
} from "./ui";

function relativeTime(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

function WeatherIcon({ label }: { label: string }) {
  if (label.toLowerCase().includes("snow")) return <Snowflake aria-hidden="true" />;
  if (label.toLowerCase().includes("rain") || label.toLowerCase().includes("shower")) return <CloudRain aria-hidden="true" />;
  if (label === "Clear") return <Sun aria-hidden="true" />;
  return <CloudSun aria-hidden="true" />;
}

// Each variant owns its fill, border, and sizing so Tailwind's utility order
// cannot blur the distinction between today, tomorrow, and later dates.
const statusBadge =
  "inline-flex w-fit items-center gap-1.5 rounded-md border [&_svg]:size-3";
const statusBadgeDim = "border-white/30 bg-white/15 px-2 py-[3px] text-[0.68rem] font-[650]";
const statusBadgeSolid = "border-transparent bg-white px-2 py-[3px] text-[0.68rem] font-[650] text-[#18181b]";
const statusBadgeTomorrow = "border-white/30 bg-white px-3 py-1.5 text-[0.78rem] font-[800] uppercase tracking-[0.055em] text-[#422006] shadow-[0_0_0_3px_rgba(254,240,138,0.2)]";
const statusBadgeMoved = "border-white/30 bg-white/15 px-2 py-[3px] text-[0.68rem] font-[650] text-[#9a3412]";
const detailRow =
  "flex items-start gap-3 [&>svg]:mt-[3px] [&>svg]:shrink-0 [&>svg]:opacity-75 [&_span]:grid [&_span]:gap-[2px] [&_span]:text-[0.77rem] [&_span]:opacity-[0.82] [&_strong]:text-[0.91rem] [&_strong]:opacity-100";

interface OverviewViewProps {
  state: ClientState;
  plan: PlannedNotification[];
  occurrences: Occurrence[];
  accessKey: string;
  profileId: ProfileId;
  onNavigate: (view: ViewId) => void;
}

export function OverviewView({ state, plan, occurrences, accessKey, profileId, onNavigate }: OverviewViewProps) {
  const [now, setNow] = useState(() => new Date());
  const [runStatus, setRunStatus] = useState("Sync notifications");
  const reduceMotion = useReducedMotion();
  const timezone = state.schedule.term.timezone;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  // Cancelled classes stay in the agenda, greyed out, so a change is visible
  // rather than silently removing the row. They are still skipped for "next up".
  const upcoming = occurrences.filter((item) => new Date(item.end) > now);
  const available = upcoming.filter((item) => !item.cancelled);
  const next = available[0];
  const active = next && new Date(next.start) <= now && now < new Date(next.end);
  const progress = active ? Math.min(100, Math.max(0, (now.getTime() - new Date(next.start).getTime()) / (new Date(next.end).getTime() - new Date(next.start).getTime()) * 100)) : 0;
  const countdown = next ? active ? `${relativeTime(new Date(next.end).getTime() - now.getTime())} left` : `Starts in ${relativeTime(new Date(next.start).getTime() - now.getTime())}` : "Term complete";
  const nextDayLabel = next ? formatDayLabel(next.start, timezone, now) : null;
  // Keep today's badge subtle, distinguish tomorrow, and show later dates plainly.
  const nextIsAnotherDay = Boolean(next) && !active && nextDayLabel !== "Today";
  const nextBadgeStyle = active
    ? statusBadgeSolid
    : nextDayLabel === "Today"
      ? statusBadgeDim
      : nextDayLabel === "Tomorrow"
        ? statusBadgeTomorrow
        : statusBadgeSolid;
  const leaveAlert = next ? plan.find((item) => item.occurrenceId === next.id && item.kind === "leave") : undefined;
  const later = upcoming.filter((item) => item.id !== next?.id).slice(0, 5);
  const pendingAlerts = state.scheduledNotifications.filter((item) => new Date(item.dueAt) > now).length;

  async function checkNow() {
    setRunStatus("Checking…");
    try {
      const result = await syncNotifications(accessKey, profileId);
      setRunStatus(!result.ok ? `${result.failed} failed` : result.reason ?? `${result.scheduled} scheduled`);
    } catch (error) {
      setRunStatus(error instanceof Error ? error.message : "Check failed");
    }
    window.setTimeout(() => setRunStatus("Sync notifications"), 2500);
  }

  return (
    <div className={pageStack}>
      <header className={pageHeading}>
        <div>
          <p className="overline">{formatDayLabel(now.toISOString(), timezone, now)}</p>
          <h1>{active ? "You’re in class" : "Your next move"}</h1>
        </div>
        <button type="button" className={cx(button.secondary, "max-nav:hidden")} onClick={checkNow}>
          <Play aria-hidden="true" /><TextMorph duration={170} respectReducedMotion>{runStatus}</TextMorph>
        </button>
      </header>

      {next ? (
        <section
          className={cx(
            "next-class course-" + next.course.color,
            nextIsAnotherDay && "is-another-day",
            "relative grid min-h-[300px] grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)] overflow-hidden rounded-card text-[#f8fafc] max-nav:min-h-0 max-nav:grid-cols-1",
          )}
          aria-labelledby="next-course"
        >
          <div className="flex min-w-0 flex-col p-[clamp(24px,4vw,44px)] max-nav:min-h-[270px]">
            <div className="flex gap-[7px]">
              <span className={cx(statusBadge, nextBadgeStyle)}>
                {nextIsAnotherDay && <CalendarDays aria-hidden="true" />}
                {active ? "In progress" : nextDayLabel}
              </span>
              {next.moved && <span className={cx(statusBadge, statusBadgeMoved)}>Moved</span>}
            </div>
            <div className="mt-auto pt-[30px]">
              <p className="font-mono text-[0.82rem] font-[650] leading-[1.2] opacity-[0.78]">{next.course.code}</p>
              <h2 id="next-course" className="mt-[7px] max-w-[16ch] text-[clamp(1.7rem,4vw,3.15rem)] leading-[0.98] tracking-[-0.045em] max-nav:max-w-[17ch] max-nav:text-[2rem]">
                {state.settings.display.showCourseNames ? next.course.name : next.section}
              </h2>
            </div>
            <div className="mt-3.5 min-h-[34px] text-[clamp(1rem,2vw,1.3rem)] opacity-[0.92] [&_strong]:font-[520]" aria-live="polite">
              <TextMorph as="strong" duration={220} scale={false} respectReducedMotion>{countdown}</TextMorph>
            </div>
            {next.moved && next.note && (
              <p className="mt-1.5 max-w-[42ch] text-[0.73rem] leading-[1.35] text-white/75">{next.note}</p>
            )}
            {active && (
              <div className="class-progress mt-[22px] h-1 overflow-hidden rounded-[4px] bg-white/20" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label={`${Math.round(progress)} percent of class elapsed`}>
                <motion.div initial={false} animate={{ width: `${progress}%` }} transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }} />
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center gap-5 bg-black/15 p-[clamp(22px,3vw,34px)] max-nav:gap-4 max-nav:p-5">
            <div className={detailRow}><CalendarClock aria-hidden="true" /><span><strong>{formatClock(next.start, timezone, state.settings.display.clock)}–{formatClock(next.end, timezone, state.settings.display.clock)}</strong>{next.section}</span></div>
            <div className={detailRow}><MapPin aria-hidden="true" /><span><strong>{next.building.code} {next.room}</strong>{next.building.name}</span></div>
            {leaveAlert && (
              <div className={cx(detailRow, "-mx-[13px] -my-1 rounded-lg bg-white/[0.11] p-[13px]")}><Footprints aria-hidden="true" /><span><strong>Leave at {formatClock(leaveAlert.dueAt, timezone, state.settings.display.clock)}</strong>{leaveAlert.walkMinutes} min with weather buffer</span></div>
            )}
            {leaveAlert?.weather && (
              <div className="flex items-center gap-3.5 border-t border-white/20 pt-[18px] text-[0.71rem] max-nav:flex-wrap [&>svg]:shrink-0 [&_span]:grid [&_span:nth-last-child(-n+2)]:inline [&_span:nth-last-child(-n+2)]:opacity-[0.72] max-xs:[&_span:nth-last-child(-n+2)]:w-[calc(50%-10px)]">
                <WeatherIcon label={leaveAlert.weather.label} />
                <span><strong>{leaveAlert.weather.temperature}°</strong>{leaveAlert.weather.label}</span>
                <span>{leaveAlert.weather.precipitationProbability}% precip.</span>
                <span>{leaveAlert.weather.windSpeed} km/h wind</span>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className={emptyState}><CalendarClock aria-hidden="true" /><h2>No classes ahead</h2><p>The current term has no remaining scheduled meetings.</p></section>
      )}

      <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)] gap-4 max-nav:grid-cols-1">
        <section className={panel} aria-labelledby="agenda-title">
          <header className={panelHeader}><div><p className="overline mb-[5px]">Next 14 days</p><h2 id="agenda-title">Coming up</h2></div><button className={textButton} type="button" onClick={() => onNavigate("schedule")}>Full schedule</button></header>
          {later.length ? (
            <ol className="m-0 list-none p-0 [&_span]:text-[0.7rem] [&_span]:text-muted [&_strong]:text-[0.8rem]">
              {later.map((item) => (
                <li key={item.id} className={cx("grid min-h-[68px] grid-cols-[9px_minmax(0,1fr)_auto] items-center gap-[13px] border-b border-line px-4 py-2.5 last:border-b-0 max-xs:grid-cols-[8px_minmax(0,1fr)] [&>div]:grid", item.cancelled && "opacity-60")}>
                  <span className={cx("course-pin course-" + item.course.color, item.cancelled && "opacity-40")} aria-hidden="true" />
                  <div><strong className={cx(item.cancelled && "line-through")}>{item.course.code}</strong><span>{formatDayLabel(item.start, timezone, now)} · {formatClock(item.start, timezone, state.settings.display.clock)}</span></div>
                  <div className="text-right max-xs:col-start-2 max-xs:-mt-[7px] max-xs:text-left">
                    <strong className={cx(item.cancelled && "text-danger", item.moved && "text-accent-ink")}>{item.cancelled ? "Cancelled" : `${item.building.code} ${item.room}`}</strong>
                    <span>{item.moved ? `Moved · ${item.section}` : item.section}</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : <div className={compactEmpty}>Nothing else scheduled.</div>}
        </section>

        <aside className={cx(panel, "flex min-h-[250px] flex-col items-start p-[22px] max-nav:min-h-[230px]")} aria-labelledby="alert-title">
          <div className="mb-auto grid size-[42px] place-items-center rounded-[9px] bg-accent-soft text-accent"><BellRing aria-hidden="true" /></div>
          <p className="overline mt-[26px]">Notification plan</p>
          <h2 id="alert-title" className="mt-[7px] text-[1.25rem]"><span className="tabular">{pendingAlerts}</span> alerts scheduled</h2>
          <p className="mb-[18px] mt-2 max-w-[34ch] text-[0.8rem] text-muted">ntfy holds the next three days of alerts. Saves replace moves or cancellations immediately.</p>
          <button type="button" className={button.secondary} onClick={() => onNavigate("notifications")}>Manage alerts</button>
          <button type="button" className={cx(button.quiet, "hidden max-nav:inline-flex")} onClick={checkNow}><Play aria-hidden="true" /><TextMorph duration={170} respectReducedMotion>{runStatus}</TextMorph></button>
        </aside>
      </div>
    </div>
  );
}

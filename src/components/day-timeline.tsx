"use client";

/**
 * One day drawn to scale: class blocks positioned on a shared minute axis with
 * the gaps between them rendered as their own blocks.
 *
 * The weekly gap map renders five of these across one week; the compare view
 * renders one weekday across several profiles. Both share this module so the two
 * stay visually identical — the geometry is computed inline, the visual language
 * (gridlines, hatched gap blocks, swatches) lives in `globals.css`.
 */

import { ArrowRight, CalendarX2, Footprints, MoveRight, Repeat } from "lucide-react";
import type { DayTimeline, TimelineGap } from "@/lib/types";

export const weekdays = [
  { day: 1, label: "Monday", short: "Mon" },
  { day: 2, label: "Tuesday", short: "Tue" },
  { day: 3, label: "Wednesday", short: "Wed" },
  { day: 4, label: "Thursday", short: "Thu" },
  { day: 5, label: "Friday", short: "Fri" },
];

export const PX_PER_MIN = 0.9;
const MIN_LABEL_HEIGHT = 44;

export function durationLabel(minutes: number) {
  if (minutes <= 0) return "Back-to-back";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function gapTone(minutes: number) {
  if (minutes <= 0) return "touch";
  if (minutes <= 20) return "tight";
  if (minutes <= 90) return "short";
  return "long";
}

function sectionLabel(section: string) {
  const [code = "", ...numberParts] = section.trim().split(/\s+/);
  const compactSection = `${code}${numberParts.join("")}`;
  const type = code === "LEC" ? "Lecture" : code === "TUT" ? "Tutorial" : code === "PRA" ? "Lab" : code;
  return { type, compactSection };
}

/** Builds the shared axis helpers for a range of minutes past midnight. */
export function timelineAxis(rangeStart: number, rangeEnd: number) {
  const marks: number[] = [];
  for (let mark = rangeStart; mark <= rangeEnd; mark += 60) marks.push(mark);
  return {
    marks,
    totalHeight: Math.max(1, (rangeEnd - rangeStart) * PX_PER_MIN),
    offset: (minutes: number) => (minutes - rangeStart) * PX_PER_MIN,
  };
}

export function TimelineAxisColumn({
  marks,
  totalHeight,
  offset,
  timeText,
}: {
  marks: number[];
  totalHeight: number;
  offset: (minutes: number) => number;
  timeText: (value: string) => string;
}) {
  return (
    <div className="gap-axis" style={{ height: `${totalHeight}px` }} aria-hidden="true">
      {marks.map((mark) => (
        <span key={mark} className="gap-axis-mark" style={{ top: `${offset(mark)}px` }}>
          {timeText(`${String(Math.floor(mark / 60)).padStart(2, "0")}:00`)}
        </span>
      ))}
    </div>
  );
}

interface DayTrackProps {
  day: DayTimeline | undefined;
  marks: number[];
  totalHeight: number;
  offset: (minutes: number) => number;
  timeText: (value: string) => string;
  emptyLabel?: string;
  /** `showLabel: false` draws just the line, for columns beside one that already carries the pill. */
  currentTime?: { minutes: number; label: string; showLabel?: boolean };
}

export function DayTrack({ day, marks, totalHeight, offset, timeText, emptyLabel = "No classes scheduled.", currentTime }: DayTrackProps) {
  const classes = day?.classes ?? [];
  const gaps = day?.gaps ?? [];

  return (
    <div className="gap-track" style={{ height: `${totalHeight}px` }}>
      {marks.map((mark) => (
        <i key={mark} className="gap-gridline" style={{ top: `${offset(mark)}px` }} aria-hidden="true" />
      ))}

      {currentTime && (currentTime.showLabel === false ? (
        <div className="gap-now gap-now-bare" style={{ top: `${offset(currentTime.minutes)}px` }} aria-hidden="true" />
      ) : (
        <div
          className="gap-now"
          style={{ top: `${offset(currentTime.minutes)}px` }}
          role="img"
          aria-label={`Current time: ${currentTime.label}`}
        >
          <span aria-hidden="true">Now · {currentTime.label}</span>
        </div>
      ))}

      {classes.length === 0 && <p className="gap-track-empty">{emptyLabel}</p>}

      {classes.map((entry) => {
        const height = Math.max(entry.minutes * PX_PER_MIN, 22);
        const compact = height < MIN_LABEL_HEIGHT;
        const section = sectionLabel(entry.section);
        const exception = entry.exception;
        const cancelled = exception?.kind === "cancelled";
        const moved = exception?.kind === "moved";
        // A screen reader gets the full reason even when the block is too short
        // to print it — a title attribute alone would miss touch users entirely.
        const exceptionSummary = cancelled
          ? `Cancelled this week${exception.note ? `: ${exception.note}` : "."}`
          : moved
            ? `Moved this week to ${timeText(exception.startsAt ?? entry.startsAt)}–${timeText(exception.endsAt ?? entry.endsAt)}${exception.building ? ` in ${exception.building} ${exception.room}` : ""}${exception.note ? ` — ${exception.note}` : ""}`
            : undefined;
        return (
          <article
            key={entry.meetingId}
            className={`gap-class course-${entry.color}${compact ? " is-compact" : ""}${cancelled ? " is-cancelled" : ""}${moved ? " is-moved" : ""}`}
            style={{ top: `${offset(entry.startMinutes)}px`, height: `${height}px` }}
            aria-label={exceptionSummary ? `${entry.courseCode}, ${section.type}. ${exceptionSummary}` : undefined}
          >
            <span className="gap-class-code">{entry.courseCode}</span>
            <span className="gap-class-section">{section.type} · {section.compactSection}</span>
            {/* An exception replaces the normal time/room line rather than
                appending to it — showing both the usual slot and the reason
                it doesn't apply left too little room in a short block, and
                doubled up on information besides. */}
            {!exception && (
              <span className="gap-class-meta">
                <time>{timeText(entry.startsAt)}–{timeText(entry.endsAt)}</time>
                <span className="gap-class-room">{entry.building} {entry.room}</span>
              </span>
            )}
            {cancelled && (
              <span className="gap-class-exception">
                <span className="gap-class-tag"><CalendarX2 aria-hidden="true" />Cancelled</span>
                {exception.note && <span className="gap-class-note">{exception.note}</span>}
              </span>
            )}
            {moved && (
              <span className="gap-class-exception">
                <span className="gap-class-tag">
                  <Repeat aria-hidden="true" />
                  Moved{exception.startsAt ? ` · ${timeText(exception.startsAt)}–${timeText(exception.endsAt ?? entry.endsAt)}` : ""}
                </span>
                {(exception.building || exception.room) && <span className="gap-class-note">{exception.building ?? entry.building} {exception.room ?? entry.room}</span>}
                {exception.note && <span className="gap-class-note">{exception.note}</span>}
              </span>
            )}
          </article>
        );
      })}

      {gaps.map((gap: TimelineGap) => {
        const tone = gapTone(gap.minutes);
        if (tone === "touch") {
          return (
            <div
              key={gap.id}
              className="gap-touch"
              style={{ top: `${offset(gap.startMinutes)}px` }}
              role="img"
              aria-label={`${gap.from.courseCode} runs straight into ${gap.to.courseCode}${gap.changesBuilding ? `, moving from ${gap.from.building} to ${gap.to.building}` : ""}`}
            >
              <span>
                <MoveRight aria-hidden="true" />
                Back-to-back{gap.changesBuilding ? ` · ${gap.from.building}→${gap.to.building}` : ""}
              </span>
            </div>
          );
        }
        const height = Math.max(gap.minutes * PX_PER_MIN, 26);
        const compact = height < MIN_LABEL_HEIGHT;
        return (
          <div
            key={gap.id}
            className={`gap-block gap-${tone}${compact ? " is-compact" : ""}`}
            style={{ top: `${offset(gap.startMinutes)}px`, height: `${height}px` }}
            role="img"
            aria-label={`${durationLabel(gap.minutes)} gap from ${gap.from.courseCode} at ${timeText(gap.startsAt)} to ${gap.to.courseCode} at ${timeText(gap.endsAt)}${gap.changesBuilding ? `, ${gap.from.building} to ${gap.to.building}` : ""}`}
          >
            <span className="gap-block-dur">{durationLabel(gap.minutes)}</span>
            {!compact && (
              <span className="gap-block-route">
                {gap.changesBuilding ? <Footprints aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
                {gap.from.building}
                {gap.changesBuilding ? ` → ${gap.to.building}` : " · stay put"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** `showExceptions` adds swatches for cancelled/moved — only meaningful on a
 * view that actually overlays this week's exceptions onto the timeline. */
export function GapLegend({ showExceptions = false }: { showExceptions?: boolean }) {
  return (
    <div className="gap-legend" aria-hidden="true">
      <span className="gap-legend-item"><i className="swatch swatch-class" />Class</span>
      <span className="gap-legend-item"><i className="swatch swatch-gap-short" />Gap under 90 min</span>
      <span className="gap-legend-item"><i className="swatch swatch-gap-long" />Gap over 90 min</span>
      <span className="gap-legend-item"><i className="swatch swatch-touch" />Back-to-back</span>
      <span className="gap-legend-item"><Footprints aria-hidden="true" />Building change</span>
      {showExceptions && (
        <>
          <span className="gap-legend-item"><i className="swatch swatch-cancelled" /><CalendarX2 aria-hidden="true" />Cancelled this week</span>
          <span className="gap-legend-item"><i className="swatch swatch-moved" /><Repeat aria-hidden="true" />Moved this week</span>
        </>
      )}
    </div>
  );
}

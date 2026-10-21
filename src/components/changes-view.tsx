"use client";

import { FormEvent, useState } from "react";
import { CalendarX2, Clock3, MapPin, Plus, Trash2 } from "lucide-react";
import type { ClientState } from "@/lib/client-api";
import type { ScheduleException } from "@/lib/types";
import {
  button,
  badge,
  cx,
  emptyState,
  field,
  fieldLabel,
  fieldSpan2,
  iconButtonDanger,
  pageDescription,
  pageHeading,
  pageStack,
  panel,
  panelHeader,
  statusBadge,
} from "./ui";

function tomorrowDate() {
  const date = new Date(Date.now() + 86_400_000);
  return date.toISOString().slice(0, 10);
}

const formGrid = "grid grid-cols-2 gap-4 p-4 max-xs:grid-cols-1";
const changeCopy =
  "min-w-0 [&>div]:flex [&>div]:flex-wrap [&>div]:items-center [&>div]:gap-[7px] [&>time]:mt-[3px] [&>time]:block [&>time]:text-[0.7rem] [&>time]:text-muted [&_p]:mt-2 [&_p]:flex [&_p]:items-center [&_p]:gap-[5px] [&_p]:text-[0.7rem] [&_p]:text-muted [&_p_svg]:size-[13px] [&_p_svg:nth-of-type(2)]:ml-[7px] [&_small]:mt-[6px] [&_small]:block [&_small]:text-faint";

export function ChangesView({ state, onSave }: { state: ClientState; onSave: (state: ClientState) => Promise<void> }) {
  const firstMeeting = state.schedule.meetings[0];
  const [meetingId, setMeetingId] = useState(firstMeeting.id);
  const [date, setDate] = useState(tomorrowDate());
  const [kind, setKind] = useState<"cancelled" | "moved">("cancelled");
  const [startsAt, setStartsAt] = useState(firstMeeting.startsAt);
  const [endsAt, setEndsAt] = useState(firstMeeting.endsAt);
  const [building, setBuilding] = useState(firstMeeting.building);
  const [room, setRoom] = useState(firstMeeting.room);
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");

  function chooseMeeting(id: string) {
    setMeetingId(id);
    const meeting = state.schedule.meetings.find((item) => item.id === id);
    if (!meeting) return;
    setStartsAt(meeting.startsAt);
    setEndsAt(meeting.endsAt);
    setBuilding(meeting.building);
    setRoom(meeting.room);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (kind === "moved" && startsAt >= endsAt) {
      setFeedback("End time must be after start time.");
      return;
    }
    const change: ScheduleException = {
      id: `${date}:${meetingId}`,
      meetingId,
      date,
      kind,
      ...(kind === "moved" ? { startsAt, endsAt, building, room } : {}),
      note,
      createdAt: new Date().toISOString(),
    };
    const exceptions = [...state.exceptions.filter((item) => item.id !== change.id), change].sort((a, b) => a.date.localeCompare(b.date));
    await onSave({ ...state, exceptions });
    setFeedback(kind === "cancelled" ? "Cancellation added." : "Class move added.");
    setNote("");
  }

  async function remove(change: ScheduleException) {
    if (!window.confirm("Remove this temporary schedule change?")) return;
    await onSave({ ...state, exceptions: state.exceptions.filter((item) => item.id !== change.id) });
  }

  const describeMeeting = (id: string) => {
    const meeting = state.schedule.meetings.find((item) => item.id === id);
    const course = state.schedule.courses.find((item) => item.id === meeting?.courseId);
    return meeting && course ? `${course.code} · ${meeting.section}` : id;
  };

  return (
    <div className={pageStack}>
      <header className={pageHeading}><div><p className="overline mb-[7px]">One-off overrides</p><h1>Cancellations & moves</h1><p className={pageDescription}>Changes apply to one date only and immediately update the notification plan.</p></div></header>

      <div className="grid grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] items-start gap-4 max-nav:grid-cols-1">
        <section className={cx(panel, "overflow-hidden")} aria-labelledby="change-form-title">
          <header className={panelHeader}><div><p className="overline mb-[5px]">Add change</p><h2 id="change-form-title">Override a class</h2></div><Plus aria-hidden="true" /></header>
          <form className={formGrid} onSubmit={submit}>
            <div className={cx(field, fieldSpan2)}><label htmlFor="change-meeting" className={fieldLabel}>Class</label><select id="change-meeting" value={meetingId} onChange={(event) => chooseMeeting(event.target.value)}>{state.schedule.meetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{describeMeeting(meeting.id)} · {meeting.startsAt} · {meeting.building} {meeting.room}</option>)}</select></div>
            <div className={field}><label htmlFor="change-date" className={fieldLabel}>Date</label><input id="change-date" type="date" min={state.schedule.term.startsOn} max={state.schedule.term.endsOn} value={date} onChange={(event) => setDate(event.target.value)} required /></div>
            <fieldset className={cx(field, "m-0 border-0 p-0")}><legend className={fieldLabel}>Change type</legend><div className="segmented-control"><label><input type="radio" name="kind" value="cancelled" checked={kind === "cancelled"} onChange={() => setKind("cancelled")} /><span>Cancelled</span></label><label><input type="radio" name="kind" value="moved" checked={kind === "moved"} onChange={() => setKind("moved")} /><span>Moved</span></label></div></fieldset>
            {kind === "moved" && <>
              <div className={field}><label htmlFor="move-start" className={fieldLabel}>Starts</label><input id="move-start" type="time" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></div>
              <div className={field}><label htmlFor="move-end" className={fieldLabel}>Ends</label><input id="move-end" type="time" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required /></div>
              <div className={field}><label htmlFor="move-building" className={fieldLabel}>Building</label><select id="move-building" value={building} onChange={(event) => setBuilding(event.target.value)}>{state.schedule.buildings.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></div>
              <div className={field}><label htmlFor="move-room" className={fieldLabel}>Room</label><input id="move-room" value={room} onChange={(event) => setRoom(event.target.value)} required /></div>
            </>}
            <div className={cx(field, fieldSpan2)}><label htmlFor="change-note" className={fieldLabel}>Note <span>optional</span></label><textarea id="change-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Reason or anything useful to remember" /></div>
            {feedback && <p className={cx("text-[0.76rem] text-success", fieldSpan2)} role="status">{feedback}</p>}
            <button type="submit" className={cx(button.primary, fieldSpan2)}><Plus aria-hidden="true" />Add temporary change</button>
          </form>
        </section>

        <section className={cx(panel, "overflow-hidden")} aria-labelledby="changes-title">
          <header className={panelHeader}><div><p className="overline mb-[5px]">Active</p><h2 id="changes-title">Temporary changes</h2></div><span className={badge}>{state.exceptions.length}</span></header>
          {state.exceptions.length ? <ul className="m-0 list-none p-0">{state.exceptions.map((change) => {
            const meeting = state.schedule.meetings.find((item) => item.id === change.meetingId);
            return <li key={change.id} className="grid grid-cols-[38px_minmax(0,1fr)_38px] gap-[11px] border-b border-line px-[13px] py-[15px] last:border-b-0 max-xs:grid-cols-[36px_minmax(0,1fr)_38px]">
              <div className={cx("grid size-[38px] place-items-center rounded-lg", change.kind === "moved" ? "bg-accent-soft text-accent" : "bg-[color-mix(in_srgb,var(--danger)_9%,var(--surface))] text-danger")}><CalendarX2 aria-hidden="true" /></div>
              <div className={changeCopy}><div><strong>{describeMeeting(change.meetingId)}</strong><span className={change.kind === "moved" ? statusBadge.changed : statusBadge.cancelled}>{change.kind}</span></div><time>{new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${change.date}T12:00:00Z`))}</time>
                {change.kind === "moved" && <p><Clock3 aria-hidden="true" />{change.startsAt}–{change.endsAt}<MapPin aria-hidden="true" />{change.building} {change.room}</p>}
                {change.kind === "cancelled" && meeting && <p><Clock3 aria-hidden="true" />Was {meeting.startsAt}–{meeting.endsAt}<MapPin aria-hidden="true" />{meeting.building} {meeting.room}</p>}
                {change.note && <small>{change.note}</small>}
              </div>
              <button type="button" className={iconButtonDanger} onClick={() => remove(change)} aria-label={`Remove change for ${describeMeeting(change.meetingId)}`}><Trash2 aria-hidden="true" /></button>
            </li>;
          })}</ul> : <div className={cx(emptyState, "min-h-[220px]")}><CalendarX2 aria-hidden="true" /><h3>No temporary changes</h3><p>Your base schedule is currently untouched.</p></div>}
        </section>
      </div>
    </div>
  );
}

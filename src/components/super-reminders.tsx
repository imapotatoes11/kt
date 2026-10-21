"use client";

import { useState, type FormEvent } from "react";
import { AlarmClock, Plus, Trash2 } from "lucide-react";
import { fromZonedTime } from "date-fns-tz";
import { getLocalDate } from "@/lib/schedule";
import { SUPER_REMINDER_OFFSETS, type SuperReminder, type SuperReminderOffset } from "@/lib/types";
import { badge, button, compactEmpty, cx, field, fieldLabel, iconButtonDanger, panelHeader } from "./ui";

function shortOffset(offset: SuperReminderOffset) {
  return offset >= 60 ? `${offset / 60}h` : `${offset}m`;
}

function eventInstant(reminder: Pick<SuperReminder, "date" | "time">, timezone: string) {
  return fromZonedTime(`${reminder.date}T${reminder.time}:00`, timezone);
}

function updateOffset(offsets: SuperReminderOffset[], offset: SuperReminderOffset, enabled: boolean) {
  if (!enabled && offsets.length === 1) return offsets;
  const next = enabled ? [...offsets, offset] : offsets.filter((value) => value !== offset);
  return SUPER_REMINDER_OFFSETS.filter((value) => next.includes(value));
}

function LeadTimeChoices({ idPrefix, offsets, onChange }: { idPrefix: string; offsets: SuperReminderOffset[]; onChange: (offsets: SuperReminderOffset[]) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className={fieldLabel}>Send before</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {SUPER_REMINDER_OFFSETS.map((offset) => {
          const checked = offsets.includes(offset);
          const isLast = checked && offsets.length === 1;
          return (
            <label key={offset} htmlFor={`${idPrefix}-${offset}`} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-input border border-line bg-surface-subtle px-3 text-[0.76rem] font-semibold transition-[background-color,border-color] duration-[130ms] hover:border-faint has-[:checked]:border-accent-line has-[:checked]:bg-accent-soft has-[:checked]:text-accent-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
              <input
                id={`${idPrefix}-${offset}`}
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={isLast}
                onChange={(event) => onChange(updateOffset(offsets, offset, event.target.checked))}
              />
              {shortOffset(offset)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

interface SuperRemindersProps {
  reminders: SuperReminder[];
  timezone: string;
  clock: "12h" | "24h";
  onChange: (reminders: SuperReminder[]) => void;
}

export function SuperReminders({ reminders, timezone, clock, onChange }: SuperRemindersProps) {
  const today = getLocalDate(timezone);
  const [referenceTime] = useState(() => Date.now());
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [offsets, setOffsets] = useState<SuperReminderOffset[]>([...SUPER_REMINDER_OFFSETS]);
  const [feedback, setFeedback] = useState("");

  function addReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setFeedback("Enter what you want to be reminded about.");
      return;
    }
    const eventAt = eventInstant({ date, time }, timezone);
    const hasFutureDelivery = offsets.some((offset) => eventAt.getTime() - offset * 60_000 >= Date.now() + 10_000);
    if (!hasFutureDelivery) {
      setFeedback("Choose a time far enough ahead for at least one selected alert.");
      return;
    }

    onChange([...reminders, {
      id: `super-${crypto.randomUUID()}`,
      title: title.trim(),
      date,
      time,
      offsets,
      createdAt: new Date().toISOString(),
    }]);
    setTitle("");
    setTime("");
    setOffsets([...SUPER_REMINDER_OFFSETS]);
    setFeedback("Added to the draft. Save reminders to schedule it.");
  }

  function updateReminder(id: string, patch: Partial<SuperReminder>) {
    onChange(reminders.map((reminder) => reminder.id === id ? { ...reminder, ...patch } : reminder));
  }

  function removeReminder(reminder: SuperReminder) {
    if (!window.confirm(`Delete “${reminder.title}” and cancel its pending alerts?`)) return;
    onChange(reminders.filter((item) => item.id !== reminder.id));
    setFeedback("Removed from the draft. Save reminders to cancel pending pushes.");
  }

  const ordered = [...reminders].sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`));

  return (
    <>
      <header className={panelHeader}>
        <div>
          <p className="overline mb-[5px]">Schedule-free</p>
          <h2 id="super-reminder-title">Super reminder</h2>
        </div>
        <AlarmClock aria-hidden="true" />
      </header>

      <form className="grid grid-cols-[minmax(220px,1.4fr)_150px_130px_auto] items-end gap-3.5 border-b border-line p-4 max-wide:grid-cols-[minmax(220px,1fr)_150px_130px] max-nav:grid-cols-2 max-xs:grid-cols-1" onSubmit={addReminder}>
        <div className={cx(field, "max-nav:col-span-2 max-xs:col-auto")}>
          <label htmlFor="super-reminder-name" className={fieldLabel}>What should ntfy remind you about?</label>
          <input id="super-reminder-name" value={title} maxLength={120} required placeholder="Submit OSAP documents" onChange={(event) => { setTitle(event.target.value); setFeedback(""); }} />
        </div>
        <div className={field}>
          <label htmlFor="super-reminder-date" className={fieldLabel}>Date</label>
          <input id="super-reminder-date" type="date" min={today} value={date} required onChange={(event) => { setDate(event.target.value); setFeedback(""); }} />
        </div>
        <div className={field}>
          <label htmlFor="super-reminder-time" className={fieldLabel}>Time</label>
          <input id="super-reminder-time" type="time" value={time} required onChange={(event) => { setTime(event.target.value); setFeedback(""); }} />
        </div>
        <button className={cx(button.primary, "max-wide:col-span-full max-wide:justify-self-start max-nav:col-span-2 max-xs:col-auto max-xs:w-full")} type="submit"><Plus aria-hidden="true" />Add reminder</button>
        <div className="col-span-full">
          <LeadTimeChoices idPrefix="new-super-reminder" offsets={offsets} onChange={setOffsets} />
          <p className={cx("mt-2 min-h-[1.1rem] text-[0.72rem]", feedback.startsWith("Choose") || feedback.startsWith("Enter") ? "text-danger" : "text-muted")} aria-live="polite">{feedback || "All seven alerts are on by default. Turn off any lead times you do not need."}</p>
        </div>
      </form>

      {ordered.length ? (
        <div className="grid">
          {ordered.map((reminder) => {
            const instant = eventInstant(reminder, timezone);
            const isPast = instant.getTime() <= referenceTime;
            const displayDate = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: clock === "12h" }).format(instant);
            return (
              <article key={reminder.id} className="grid grid-cols-[minmax(220px,1.4fr)_150px_130px_38px] items-end gap-3 border-b border-line px-4 py-3.5 last:border-b-0 max-nav:grid-cols-[minmax(0,1fr)_38px]">
                <div className={cx(field, "max-nav:col-start-1")}>
                  <label htmlFor={`${reminder.id}-title`} className={fieldLabel}>Reminder <span>{displayDate}</span></label>
                  <input id={`${reminder.id}-title`} value={reminder.title} maxLength={120} required onChange={(event) => updateReminder(reminder.id, { title: event.target.value })} />
                </div>
                <div className={cx(field, "max-nav:col-start-1")}>
                  <label htmlFor={`${reminder.id}-date`} className={fieldLabel}>Date</label>
                  <input id={`${reminder.id}-date`} type="date" value={reminder.date} required onChange={(event) => updateReminder(reminder.id, { date: event.target.value })} />
                </div>
                <div className={cx(field, "max-nav:col-start-1")}>
                  <label htmlFor={`${reminder.id}-time`} className={fieldLabel}>Time</label>
                  <input id={`${reminder.id}-time`} type="time" value={reminder.time} required onChange={(event) => updateReminder(reminder.id, { time: event.target.value })} />
                </div>
                <button className={cx(iconButtonDanger, "max-nav:col-start-2 max-nav:row-start-1 max-nav:self-end")} type="button" onClick={() => removeReminder(reminder)} aria-label={`Delete ${reminder.title}`}><Trash2 aria-hidden="true" /></button>
                <div className="col-span-full flex items-end justify-between gap-3 max-nav:block">
                  <LeadTimeChoices idPrefix={reminder.id} offsets={reminder.offsets} onChange={(next) => updateReminder(reminder.id, { offsets: next })} />
                  <span className={cx(badge, "mb-[5px] shrink-0 max-nav:mt-2")}>{isPast ? "Past" : `${reminder.offsets.length} alerts`}</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : <div className={compactEmpty}>No standalone reminders yet. Add one for anything outside your timetable.</div>}
    </>
  );
}

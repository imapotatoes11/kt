"use client";

import { useState, type ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { button, cx, panel } from "./ui";

const EXAMPLE = `{
  "term": { "id": "2026-fall", "name": "Fall 2026", "timezone": "America/Toronto", "startsOn": "2026-09-08", "endsOn": "2026-12-08", "closedRanges": [] },
  "source": { "label": "My timetable", "accurateAsOf": "2026-09-07", "file": "" },
  "courses": [{ "id": "abc101", "code": "ABC101", "name": "Intro", "color": "blue" }],
  "buildings": [{ "code": "MN", "name": "Main", "latitude": 40.0, "longitude": -100.0 }],
  "meetings": [{ "id": "abc101-mon", "courseId": "abc101", "day": 1, "startsAt": "10:00", "endsAt": "11:00", "section": "LEC0101", "building": "MN", "room": "1170", "mode": "in-person" }]
}`;

interface ScheduleImportProps {
  empty: boolean;
  onImport: (schedule: unknown) => Promise<void>;
}

export function ScheduleImport({ empty, onImport }: ScheduleImportProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setText(await file.text());
  }

  async function submit() {
    setMessage("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setMessage("That is not valid JSON.");
      return;
    }
    setBusy(true);
    try {
      await onImport(parsed);
      setText("");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not import the schedule");
    } finally {
      setBusy(false);
    }
  }

  const body = (
    <div className="grid gap-3 p-4">
      <p className="text-[0.82rem] text-muted">
        Paste or upload a schedule JSON. Weekdays use <code>1</code> (Monday) to <code>5</code> (Friday) — weekend classes are not supported; times are 24-hour <code>HH:mm</code>.
        Importing replaces this profile’s timetable and keeps its settings.
      </p>
      <input type="file" accept="application/json,.json" onChange={readFile} aria-label="Schedule JSON file" />
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={10}
        spellCheck={false}
        placeholder={EXAMPLE}
        aria-label="Schedule JSON"
        className="font-mono text-[0.75rem]"
      />
      {message && <p className="text-[0.78rem] text-danger" role="alert">{message}</p>}
      <button className={cx(button.primary, "justify-self-start")} type="button" onClick={submit} disabled={busy || !text.trim()}>
        <Upload aria-hidden="true" />{busy ? "Importing…" : "Import timetable"}
      </button>
    </div>
  );

  return empty ? (
    <section className={panel} aria-labelledby="import-title">
      <header className="border-b border-line px-4 py-3"><p className="overline mb-[5px]">Get started</p><h2 id="import-title">Import your timetable</h2></header>
      {body}
    </section>
  ) : (
    <details className={panel}>
      <summary className="cursor-pointer px-4 py-3 text-[0.82rem] font-semibold">Replace timetable</summary>
      {body}
    </details>
  );
}

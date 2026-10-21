"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { TextMorph } from "torph/react";
import type { ClientState } from "@/lib/client-api";
import { SuperReminders } from "./super-reminders";
import { cx, pageDescription, pageHeadingActions, pageSaveButton, pageSaveLabel, pageStack, panel } from "./ui";

export function MiscView({ state, onSave }: { state: ClientState; onSave: (state: ClientState) => Promise<void> }) {
  const [draftReminders, setDraftReminders] = useState(() => structuredClone(state.superReminders));
  const [saveLabel, setSaveLabel] = useState("Save reminders");

  async function save() {
    setSaveLabel("Saving…");
    await onSave({ ...state, superReminders: draftReminders });
    setSaveLabel("Saved");
    window.setTimeout(() => setSaveLabel("Save reminders"), 1800);
  }

  return (
    <div className={pageStack}>
      <header className={pageHeadingActions}>
        <div>
          <p className="overline mb-[7px]">Outside the timetable</p>
          <h1>Misc</h1>
          <p className={pageDescription}>Super reminders use the ntfy connection and quiet hours configured under Changes & alerts.</p>
        </div>
        <button className={pageSaveButton} type="button" onClick={save} aria-label={saveLabel}>
          <Check aria-hidden="true" />
          <span className={pageSaveLabel}><TextMorph duration={180} respectReducedMotion>{saveLabel}</TextMorph></span>
        </button>
      </header>
      <section className={cx(panel, "overflow-hidden")} aria-labelledby="super-reminder-title">
        <SuperReminders reminders={draftReminders} timezone={state.schedule.term.timezone} clock={state.settings.display.clock} onChange={setDraftReminders} />
      </section>
    </div>
  );
}

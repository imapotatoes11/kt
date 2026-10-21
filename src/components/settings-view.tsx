"use client";

import { useEffect, useState } from "react";
import { Check, CloudSun, Footprints, MapPinned, MonitorCog } from "lucide-react";
import { TextMorph } from "torph/react";
import { ACCENTS } from "@/lib/accents";
import type { ClientState } from "@/lib/client-api";
import {
  cx,
  field,
  fieldLabel,
  fieldSpan2,
  masterToggle,
  pageDescription,
  pageHeadingActions,
  pageSaveButton,
  pageSaveLabel,
  pageStack,
  panel,
  panelHeader,
} from "./ui";

const formGrid = "grid grid-cols-2 gap-4 p-4 max-xs:grid-cols-1";
const settingsTitle = "flex items-center gap-[11px] [&>svg]:text-accent";
const bufferRow =
  "grid min-h-[54px] grid-cols-[minmax(0,1fr)_68px_30px] items-center gap-[7px] border-b border-line text-[0.76rem] last:border-b-0 [&_span]:flex [&_span]:justify-between [&_span]:gap-2 [&_small]:text-faint [&_input]:min-h-[34px] [&_input]:px-2 [&_input]:py-1.5 [&_input]:text-right [&_em]:text-[0.7rem] [&_em]:not-italic [&_em]:text-faint";

export function SettingsView({ state, onSave }: { state: ClientState; onSave: (state: ClientState) => Promise<void> }) {
  const [draft, setDraft] = useState(() => structuredClone(state.settings));
  const [label, setLabel] = useState("Save settings");

  // Theme and accent preview live while the draft is open, then revert to what is
  // actually saved when this view unmounts — picking a colour you cannot see
  // until after a round-trip to the server is not a picker.
  useEffect(() => {
    const root = document.documentElement;
    const apply = (display: ClientState["settings"]["display"]) => {
      root.dataset.theme = display.theme;
      root.dataset.accent = display.accent;
      root.style.colorScheme = display.theme === "system" ? "light dark" : display.theme;
    };
    apply(draft.display);
    return () => apply(state.settings.display);
  }, [draft.display, state.settings.display]);

  async function save() {
    setLabel("Saving…");
    await onSave({ ...state, settings: draft });
    setLabel("Saved");
    window.setTimeout(() => setLabel("Save settings"), 1800);
  }

  const setWalking = (patch: Partial<typeof draft.walking>) => setDraft({ ...draft, walking: { ...draft.walking, ...patch } });
  const speedUnit = draft.walking.speedUnit ?? "m/min";
  const speedValue = speedUnit === "km/h" ? draft.walking.metersPerMinute * 0.06 : speedUnit === "min/km" ? 1000 / draft.walking.metersPerMinute : draft.walking.metersPerMinute;
  const speedConfig = speedUnit === "m/min" ? { min: 30, max: 180, step: 1 } : speedUnit === "km/h" ? { min: 1.8, max: 10.8, step: 0.1 } : { min: 5.6, max: 33.3, step: 0.1 };
  function setSpeedUnit(unit: typeof speedUnit) {
    const current = draft.walking.metersPerMinute;
    setDraft({ ...draft, walking: { ...draft.walking, speedUnit: unit, metersPerMinute: current } });
  }
  function setSpeed(value: number) {
    const metersPerMinute = speedUnit === "km/h" ? value / 0.06 : speedUnit === "min/km" ? 1000 / value : value;
    setWalking({ metersPerMinute });
  }

  return (
    <div className={pageStack}>
      <header className={pageHeadingActions}><div><p className="overline mb-[7px]">Preferences</p><h1>How the app works for you</h1><p className={pageDescription}>Tune the route assumptions, weather padding, time format, and appearance.</p></div><button className={pageSaveButton} type="button" onClick={save} aria-label={label}><Check aria-hidden="true" /><span className={pageSaveLabel}><TextMorph duration={180} respectReducedMotion>{label}</TextMorph></span></button></header>

      <div className="grid grid-cols-2 items-start gap-4 max-nav:grid-cols-1">
        <section className={cx(panel, "overflow-hidden")}><header className={panelHeader}><div className={settingsTitle}><MapPinned aria-hidden="true" /><div><p className="overline mb-[5px]">Walking</p><h2>First trip origin</h2></div></div></header><div className={formGrid}>
          <div className={cx(field, fieldSpan2)}><label htmlFor="origin-label" className={fieldLabel}>Place name</label><input id="origin-label" value={draft.walking.originLabel} onChange={(event) => setWalking({ originLabel: event.target.value })} /></div>
          <div className={field}><label htmlFor="origin-lat" className={fieldLabel}>Latitude</label><input id="origin-lat" type="number" step="0.00001" value={draft.walking.originLatitude ?? ""} onChange={(event) => setWalking({ originLatitude: event.target.value === "" ? null : Number(event.target.value) })} /></div>
          <div className={field}><label htmlFor="origin-lon" className={fieldLabel}>Longitude</label><input id="origin-lon" type="number" step="0.00001" value={draft.walking.originLongitude ?? ""} onChange={(event) => setWalking({ originLongitude: event.target.value === "" ? null : Number(event.target.value) })} /></div>
          <p className={cx("-mt-1 text-[0.7rem] text-faint", fieldSpan2)}>Used before the first class of each day. Later walks start from the previous classroom. Leave the coordinates empty to use a flat five-minute estimate for first trips.</p>
        </div></section>

        <section className={cx(panel, "overflow-hidden")}><header className={panelHeader}><div className={settingsTitle}><Footprints aria-hidden="true" /><div><p className="overline mb-[5px]">Pace</p><h2>Walking calculation</h2></div></div></header><div className={formGrid}>
          <div className={field}><label htmlFor="walk-speed" className={fieldLabel}>Walking speed</label><div className="grid grid-cols-[minmax(0,1fr)_92px] gap-[7px]"><input id="walk-speed" type="number" min={speedConfig.min} max={speedConfig.max} step={speedConfig.step} value={Number(speedValue.toFixed(1))} onChange={(event) => setSpeed(Number(event.target.value))} /><select aria-label="Walking speed unit" value={speedUnit} onChange={(event) => setSpeedUnit(event.target.value as typeof speedUnit)}><option value="m/min">m/min</option><option value="km/h">km/h</option><option value="min/km">min/km</option></select></div></div>
          <div className={field}><label htmlFor="route-factor" className={fieldLabel}>Route multiplier</label><input id="route-factor" type="number" min={1} max={3} step="0.1" value={draft.walking.routeMultiplier} onChange={(event) => setWalking({ routeMultiplier: Number(event.target.value) })} /></div>
          <div className={cx(field, fieldSpan2)}><label htmlFor="door-buffer" className={fieldLabel}>Door / stairs buffer <span>{draft.walking.doorBufferMinutes} min</span></label><input id="door-buffer" type="range" min={0} max={15} value={draft.walking.doorBufferMinutes} onChange={(event) => setWalking({ doorBufferMinutes: Number(event.target.value) })} /></div>
        </div></section>

        <section className={cx(panel, "overflow-hidden")}><header className={panelHeader}><div className={settingsTitle}><CloudSun aria-hidden="true" /><div><p className="overline mb-[5px]">Forecast</p><h2>Weather buffers</h2></div></div></header><div className="grid px-4 py-[5px]">
          <label className={bufferRow}><span>Rain <small>at {draft.walking.precipitationThreshold}%+</small></span><input type="number" min={0} max={30} value={draft.walking.rainPenaltyMinutes} onChange={(event) => setWalking({ rainPenaltyMinutes: Number(event.target.value) })} /><em>min</em></label>
          <label className={bufferRow}><span>Snow</span><input type="number" min={0} max={30} value={draft.walking.snowPenaltyMinutes} onChange={(event) => setWalking({ snowPenaltyMinutes: Number(event.target.value) })} /><em>min</em></label>
          <label className={bufferRow}><span>At or below 0°C</span><input type="number" min={0} max={30} value={draft.walking.coldPenaltyMinutes} onChange={(event) => setWalking({ coldPenaltyMinutes: Number(event.target.value) })} /><em>min</em></label>
          <label className={bufferRow}><span>Rain threshold</span><input type="number" min={0} max={100} value={draft.walking.precipitationThreshold} onChange={(event) => setWalking({ precipitationThreshold: Number(event.target.value) })} /><em>%</em></label>
        </div></section>

        <section className={cx(panel, "overflow-hidden")}><header className={panelHeader}><div className={settingsTitle}><MonitorCog aria-hidden="true" /><div><p className="overline mb-[5px]">Display</p><h2>Appearance</h2></div></div></header><div className={formGrid}>
          <fieldset className={cx(field, fieldSpan2, "m-0 border-0 p-0")}><legend className={fieldLabel}>Theme</legend><div className="segmented-control three">{(["system", "light", "dark"] as const).map((theme) => <label key={theme}><input type="radio" name="theme" value={theme} checked={draft.display.theme === theme} onChange={() => setDraft({ ...draft, display: { ...draft.display, theme } })} /><span>{theme}</span></label>)}</div></fieldset>
          <fieldset className={cx(field, fieldSpan2, "m-0 border-0 p-0")}><legend className={fieldLabel}>Accent</legend><div className="accent-picker">{ACCENTS.map((accent) => <label key={accent.id} className="accent-swatch" data-accent={accent.id}><input type="radio" name="accent" value={accent.id} checked={draft.display.accent === accent.id} onChange={() => setDraft({ ...draft, display: { ...draft.display, accent: accent.id } })} /><span aria-hidden="true" /><span className="sr-only">{accent.label}</span></label>)}</div></fieldset>
          <fieldset className={cx(field, fieldSpan2, "m-0 border-0 p-0")}><legend className={fieldLabel}>Clock</legend><div className="segmented-control"><label><input type="radio" name="clock" checked={draft.display.clock === "12h"} onChange={() => setDraft({ ...draft, display: { ...draft.display, clock: "12h" } })} /><span>12-hour</span></label><label><input type="radio" name="clock" checked={draft.display.clock === "24h"} onChange={() => setDraft({ ...draft, display: { ...draft.display, clock: "24h" } })} /><span>24-hour</span></label></div></fieldset>
          <label className={cx(masterToggle, fieldSpan2, "min-h-[52px] border-0 pb-0 pt-2.5")}><span><strong>Show full course names</strong><small>Keep codes visible either way.</small></span><span className="switch"><input type="checkbox" checked={draft.display.showCourseNames} onChange={(event) => setDraft({ ...draft, display: { ...draft.display, showCourseNames: event.target.checked } })} /><span aria-hidden="true" /></span></label>
          <label className={cx(masterToggle, fieldSpan2, "min-h-[52px] border-0 pb-0 pt-0")}><span><strong>Delayed start</strong><small>Show classes starting later than the posted time (for example UofT time, 10 minutes late). Alerts keep their own per-rule setting.</small></span><span className="switch"><input type="checkbox" checked={draft.display.delayedStart} onChange={(event) => setDraft({ ...draft, display: { ...draft.display, delayedStart: event.target.checked } })} /><span aria-hidden="true" /></span></label>
          <div className={cx(field, fieldSpan2)}><label htmlFor="start-offset" className={fieldLabel}>Start offset <span>{draft.display.startOffsetMinutes} min</span></label><input id="start-offset" type="number" min={0} max={60} value={draft.display.startOffsetMinutes} onChange={(event) => setDraft({ ...draft, display: { ...draft.display, startOffsetMinutes: Math.min(60, Math.max(0, Math.round(Number(event.target.value)))) } })} /></div>
        </div></section>
      </div>
    </div>
  );
}

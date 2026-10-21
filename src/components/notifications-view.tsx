"use client";

import { useState } from "react";
import { Bell, BellRing, Check, ExternalLink, Footprints, Plus, Send, Trash2 } from "lucide-react";
import { TextMorph } from "torph/react";
import { sendTest, syncNotifications, type ClientState } from "@/lib/client-api";
import type { NotificationRule, ProfileId } from "@/lib/types";
import {
  badge,
  badgeConnected,
  button,
  compactEmpty,
  cx,
  field,
  fieldLabel,
  iconButtonDanger,
  masterToggle,
  pageDescription,
  pageHeadingActions,
  pageSaveButton,
  pageSaveLabel,
  pageStack,
  panel,
  panelHeader,
  textButton,
} from "./ui";

const ruleRow =
  "grid min-h-[78px] items-end gap-2.5 border-b border-line px-3 py-2.5 last:border-b-0 grid-cols-[38px_34px_minmax(150px,1.3fr)_minmax(140px,0.9fr)_86px_104px_38px] max-wide:grid-cols-[38px_34px_minmax(160px,1fr)_minmax(150px,1fr)_80px_38px] max-nav:grid-cols-[38px_34px_minmax(0,1fr)_38px] max-nav:items-center max-nav:px-3.5 max-nav:py-3.5";

export function NotificationsView({ state, accessKey, profileId, onSave }: { state: ClientState; accessKey: string; profileId: ProfileId; onSave: (state: ClientState) => Promise<void> }) {
  const [draft, setDraft] = useState(() => structuredClone(state.settings));
  const [saveLabel, setSaveLabel] = useState("Save alerts");
  const [testLabel, setTestLabel] = useState("Send test");
  const [schedulerLabel, setSchedulerLabel] = useState("Sync now");

  function updateRule(id: string, patch: Partial<NotificationRule>) {
    setDraft((current) => ({ ...current, notifications: { ...current.notifications, rules: current.notifications.rules.map((rule) => rule.id === id ? { ...rule, ...patch } : rule) } }));
  }

  function addRule() {
    const id = `rule-${crypto.randomUUID()}`;
    setDraft((current) => ({ ...current, notifications: { ...current.notifications, rules: [...current.notifications.rules, { id, kind: "before-start", enabled: true, minutes: 20, label: "Class starts soon", includeWeather: false, delayedStart: false }] } }));
  }

  async function save() {
    setSaveLabel("Saving…");
    await onSave({ ...state, settings: draft });
    setSaveLabel("Saved");
    window.setTimeout(() => setSaveLabel("Save alerts"), 1800);
  }

  async function test() {
    setTestLabel("Sending…");
    try {
      await onSave({ ...state, settings: draft });
      await sendTest(accessKey, profileId);
      setTestLabel("Sent to ntfy");
    } catch (error) {
      setTestLabel(error instanceof Error ? error.message : "Test failed");
    }
    window.setTimeout(() => setTestLabel("Send test"), 2500);
  }

  async function checkScheduler() {
    setSchedulerLabel("Checking…");
    try {
      const result = await syncNotifications(accessKey, profileId);
      setSchedulerLabel(!result.ok ? `${result.failed} failed` : result.reason ?? `${result.scheduled} scheduled`);
    } catch (error) {
      setSchedulerLabel(error instanceof Error ? error.message : "Check failed");
    }
    window.setTimeout(() => setSchedulerLabel("Sync now"), 2500);
  }

  return (
    <div className={pageStack}>
      <header className={pageHeadingActions}><div><p className="overline mb-[7px]">ntfy push</p><h1>Class alerts</h1><p className={pageDescription}>Manage alerts derived from your schedule, including temporary changes and weather-adjusted walking time.</p></div><button className={pageSaveButton} type="button" onClick={save} aria-label={saveLabel}><Check aria-hidden="true" /><span className={pageSaveLabel}><TextMorph duration={180} respectReducedMotion>{saveLabel}</TextMorph></span></button></header>

      <section className={cx(panel, "overflow-hidden")} aria-labelledby="ntfy-title">
        <header className={panelHeader}><div><p className="overline mb-[5px]">Delivery</p><h2 id="ntfy-title">ntfy connection</h2></div><span className={draft.ntfy.topic ? badgeConnected : badge}>{draft.ntfy.topic ? "Topic ready" : "Needs topic"}</span></header>
        <div className="grid grid-cols-[1.25fr_1fr_130px_auto] items-end gap-3.5 p-4 max-wide:grid-cols-[1fr_1fr_120px] max-nav:grid-cols-1">
          <div className={field}><label htmlFor="ntfy-server" className={fieldLabel}>Server</label><input id="ntfy-server" type="url" value={draft.ntfy.server} onChange={(event) => setDraft({ ...draft, ntfy: { ...draft.ntfy, server: event.target.value } })} /></div>
          <div className={field}><label htmlFor="ntfy-topic" className={fieldLabel}>Private topic</label><input id="ntfy-topic" value={draft.ntfy.topic} onChange={(event) => setDraft({ ...draft, ntfy: { ...draft.ntfy, topic: event.target.value } })} placeholder="your-private-topic" /></div>
          <div className={field}><label htmlFor="ntfy-priority" className={fieldLabel}>Priority</label><select id="ntfy-priority" value={draft.ntfy.priority} onChange={(event) => setDraft({ ...draft, ntfy: { ...draft.ntfy, priority: Number(event.target.value) } })}><option value={1}>Minimum</option><option value={2}>Low</option><option value={3}>Default</option><option value={4}>High</option><option value={5}>Urgent</option></select></div>
          <div className="flex flex-wrap items-end gap-2 max-wide:col-span-full max-nav:col-auto"><button className={button.secondary} type="button" onClick={test} disabled={!draft.ntfy.topic}><Send aria-hidden="true" /><TextMorph duration={170} respectReducedMotion>{testLabel}</TextMorph></button>{draft.ntfy.topic && <a className={button.quiet} href={`${draft.ntfy.server.replace(/\/$/, "")}/${encodeURIComponent(draft.ntfy.topic)}`} target="_blank" rel="noreferrer">Open topic<ExternalLink aria-hidden="true" /></a>}</div>
        </div>
      </section>

      <section className={cx(panel, "overflow-hidden")} aria-labelledby="rules-title">
        <header className={panelHeader}><div><p className="overline mb-[5px]">Rules</p><h2 id="rules-title">When to alert</h2></div><button className={cx(button.secondary, button.small)} type="button" onClick={addRule}><Plus aria-hidden="true" />Add rule</button></header>
        <div className={masterToggle}><div><BellRing aria-hidden="true" /><span><strong>Push notifications</strong><small>Pause every scheduled alert without deleting rules.</small></span></div><label className="switch"><input type="checkbox" checked={draft.notifications.enabled} onChange={(event) => setDraft({ ...draft, notifications: { ...draft.notifications, enabled: event.target.checked } })} /><span aria-hidden="true" /></label></div>
        <div className="grid">
          {draft.notifications.rules.map((rule) => <div className={ruleRow} key={rule.id}>
            <label className="switch self-center"><input type="checkbox" checked={rule.enabled} onChange={(event) => updateRule(rule.id, { enabled: event.target.checked })} aria-label={`Enable ${rule.label}`} /><span aria-hidden="true" /></label>
            <div className="grid size-[34px] self-center place-items-center rounded-[7px] bg-surface-strong text-muted">{rule.kind === "leave" ? <Footprints aria-hidden="true" /> : <Bell aria-hidden="true" />}</div>
            <div className={cx(field, "max-nav:col-start-3 max-nav:col-end-4")}><label htmlFor={`${rule.id}-label`} className={fieldLabel}>Alert label</label><input id={`${rule.id}-label`} value={rule.label} onChange={(event) => updateRule(rule.id, { label: event.target.value })} /></div>
            <div className={cx(field, "max-nav:col-start-1 max-nav:col-end-3")}><label htmlFor={`${rule.id}-kind`} className={fieldLabel}>Event</label><select id={`${rule.id}-kind`} value={rule.kind} onChange={(event) => updateRule(rule.id, { kind: event.target.value as NotificationRule["kind"] })}><option value="leave">Time to leave</option><option value="before-start">Before class</option><option value="before-end">Before class ends</option></select></div>
            <div className={cx(field, "max-nav:col-start-3 max-nav:col-end-4")}><label htmlFor={`${rule.id}-minutes`} className={fieldLabel}>Minutes</label><input id={`${rule.id}-minutes`} type="number" min={0} max={180} value={rule.minutes} onChange={(event) => updateRule(rule.id, { minutes: Number(event.target.value) })} /></div>
            <div className="flex min-h-[38px] flex-wrap items-center gap-x-3 gap-y-1 self-center text-[0.72rem] text-muted max-wide:col-start-3 max-wide:col-end-4 max-nav:col-start-1 max-nav:col-end-3 max-nav:min-h-11">
              <label className="flex items-center gap-1.5 has-[:disabled]:opacity-50"><input type="checkbox" checked={rule.includeWeather} disabled={rule.kind !== "leave"} onChange={(event) => updateRule(rule.id, { includeWeather: event.target.checked })} />Weather</label>
              <label className="flex items-center gap-1.5 has-[:disabled]:opacity-50" title="Aim this alert at the delayed start time — the posted start plus the start offset from Settings."><input type="checkbox" checked={rule.delayedStart} disabled={rule.kind === "before-end"} onChange={(event) => updateRule(rule.id, { delayedStart: event.target.checked })} />Delayed start</label>
            </div>
            <button className={cx(iconButtonDanger, "self-center max-wide:col-start-6 max-wide:row-start-1 max-nav:col-start-4 max-nav:row-start-1")} type="button" onClick={() => setDraft((current) => ({ ...current, notifications: { ...current.notifications, rules: current.notifications.rules.filter((item) => item.id !== rule.id) } }))} aria-label={`Delete ${rule.label}`}><Trash2 aria-hidden="true" /></button>
          </div>)}
        </div>
      </section>

      <div className="grid grid-cols-[minmax(260px,0.7fr)_minmax(360px,1.3fr)] items-start gap-4 max-nav:grid-cols-1">
        <section className={panel}><header className={panelHeader}><div><p className="overline mb-[5px]">Do not disturb</p><h2>Quiet hours</h2></div></header><div className="grid grid-cols-2 gap-3 p-4"><div className={field}><label htmlFor="quiet-start" className={fieldLabel}>Starts</label><input id="quiet-start" type="time" value={draft.notifications.quietStart} onChange={(event) => setDraft({ ...draft, notifications: { ...draft.notifications, quietStart: event.target.value } })} /></div><div className={field}><label htmlFor="quiet-end" className={fieldLabel}>Ends</label><input id="quiet-end" type="time" value={draft.notifications.quietEnd} onChange={(event) => setDraft({ ...draft, notifications: { ...draft.notifications, quietEnd: event.target.value } })} /></div></div></section>
        <section className={panel}><header className={panelHeader}><div><p className="overline mb-[5px]">Scheduler</p><h2>Delivery health</h2></div><button type="button" className={textButton} onClick={checkScheduler}><TextMorph duration={170} respectReducedMotion>{schedulerLabel}</TextMorph></button></header>{state.deliveryLog.length ? <ul className="m-0 list-none p-0">{state.deliveryLog.slice(0, 4).map((item) => <li key={item.id} className="flex min-h-[52px] items-center gap-2.5 border-b border-line px-[15px] py-[9px] last:border-b-0"><i className={cx("size-[7px] shrink-0 rounded-full", item.status === "failed" ? "bg-danger" : "bg-success")} /><span className="grid"><strong className="text-[0.75rem]">{item.title}</strong><small className="text-[0.67rem] text-muted">{new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(item.sentAt))}{item.message ? ` · ${item.message}` : ""}{item.error ? ` · ${item.error}` : ""}</small></span></li>)}</ul> : <div className={compactEmpty}>No scheduler activity yet. Sync once or send a test to verify the topic.</div>}</section>
      </div>
    </div>
  );
}

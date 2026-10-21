"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell, type ViewId } from "./app-shell";
import { LoginGate } from "./login-gate";
import { OverviewView } from "./overview-view";
import { ScheduleView } from "./schedule-view";
import { CompareView } from "./compare-view";
import { ChangesAlertsView } from "./changes-alerts-view";
import { MiscView } from "./misc-view";
import { SettingsView } from "./settings-view";
import { SetupView } from "./setup-view";
import { importSchedule, loadPlan, loadState, logoutSession, saveState, syncNotifications, type ClientState } from "@/lib/client-api";
import { applyStartOffset } from "@/lib/schedule";
import type { Occurrence, PlannedNotification, ProfileId } from "@/lib/types";

const KEY_STORAGE = "timetable-access-key";
const PROFILE_STORAGE = "timetable-active-profile";
const cacheStorage = (profileId: ProfileId) => `timetable-state-cache:${profileId}`;

export function AppRoot() {
  const [key, setKey] = useState("");
  const [state, setState] = useState<ClientState | null>(null);
  const [plan, setPlan] = useState<PlannedNotification[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [profileId, setProfileId] = useState<ProfileId>("");
  const [active, setActive] = useState<ViewId>("overview");
  const [status, setStatus] = useState("Locked");
  const [error, setError] = useState("");
  const databaseReady = state?.database ?? false;

  const hydrateProfile = useCallback(async (candidate: string, nextProfileId: ProfileId) => {
    const next = await loadState(candidate, nextProfileId);
    // An empty profile ID asks the server for its default, and the response
    // says which one that was.
    const resolvedProfileId = next.profileId;
    const planning = next.database
      ? await loadPlan(candidate, resolvedProfileId)
      : { plan: [], occurrences: [] };
    localStorage.setItem(cacheStorage(resolvedProfileId), JSON.stringify(next));
    localStorage.setItem(PROFILE_STORAGE, resolvedProfileId);
    setProfileId(resolvedProfileId);
    setState(next);
    setPlan(planning.plan);
    setOccurrences(planning.occurrences);
  }, []);

  const unlock = useCallback(async (candidate: string) => {
    setStatus("Loading");
    setError("");
    try {
      const storedProfile = localStorage.getItem(PROFILE_STORAGE);
      try {
        await hydrateProfile(candidate, storedProfile ?? "");
      } catch (caught) {
        // The remembered profile may no longer be configured.
        if (!storedProfile || !(caught instanceof Error) || caught.message !== "Invalid profile") throw caught;
        await hydrateProfile(candidate, "");
      }
      localStorage.removeItem(KEY_STORAGE);
      setKey(candidate);
      setStatus("Saved");
    } catch (caught) {
      setStatus("Offline");
      setError(caught instanceof Error ? caught.message : "Could not open timetable");
    }
  }, [hydrateProfile]);

  useEffect(() => {
    const storedKey = localStorage.getItem(KEY_STORAGE);
    queueMicrotask(() => void unlock(storedKey ?? ""));
  }, [unlock]);

  useEffect(() => {
    if (!state) return;
    const root = document.documentElement;
    root.dataset.theme = state.settings.display.theme;
    root.dataset.accent = state.settings.display.accent;
    root.style.colorScheme = state.settings.display.theme === "system" ? "light dark" : state.settings.display.theme;
  }, [state]);

  async function persist(next: ClientState) {
    setState(next);
    setStatus("Saving");
    setError("");
    try {
      await saveState(key, profileId, next);
      let syncWarning = "";
      try {
        const result = await syncNotifications(key, profileId);
        if (!result.ok) syncWarning = `${result.failed} notification operation${result.failed === 1 ? "" : "s"} failed`;
      } catch (caught) {
        syncWarning = caught instanceof Error ? caught.message : "Notification sync failed";
      }
      const [fresh, planning] = await Promise.all([loadState(key, profileId), loadPlan(key, profileId)]);
      setState(fresh);
      setPlan(planning.plan);
      setOccurrences(planning.occurrences);
      localStorage.setItem(cacheStorage(profileId), JSON.stringify(fresh));
      setStatus(syncWarning ? "Saved · sync issue" : "Saved");
      if (syncWarning) setError(`Settings saved. ${syncWarning}`);
    } catch (caught) {
      setStatus("Save failed");
      setError(caught instanceof Error ? caught.message : "Could not save changes");
    }
  }

  async function importTimetable(schedule: unknown) {
    await importSchedule(key, profileId, schedule);
    // The saved timetable is what matters; a failed resync is reported
    // separately so it never reads as a failed import.
    let syncWarning = "";
    try {
      const result = await syncNotifications(key, profileId);
      if (!result.ok) syncWarning = `${result.failed} notification operation${result.failed === 1 ? "" : "s"} failed`;
    } catch (caught) {
      syncWarning = caught instanceof Error ? caught.message : "Notification sync failed";
    }
    await hydrateProfile(key, profileId);
    if (syncWarning) {
      setStatus("Saved · sync issue");
      setError(`Timetable imported. ${syncWarning}`);
    } else {
      setStatus("Saved");
      setError("");
    }
  }

  async function switchProfile(nextProfileId: ProfileId) {
    if (nextProfileId === profileId) return;
    const previousProfileId = profileId;
    setStatus("Loading");
    setError("");
    try {
      await hydrateProfile(key, nextProfileId);
      setStatus("Saved");
    } catch (caught) {
      setProfileId(previousProfileId);
      setStatus("Offline");
      setError(caught instanceof Error ? caught.message : "Could not switch profile");
    }
  }

  // Display-only shift. The notification plan applies the delayed start per rule on the
  // server, so it must keep working from the posted times.
  const displayOccurrences = useMemo(
    () => applyStartOffset(occurrences, state?.settings.display.delayedStart ? state.settings.display.startOffsetMinutes : 0),
    [occurrences, state?.settings.display.delayedStart, state?.settings.display.startOffsetMinutes],
  );

  function logout() {
    void logoutSession();
    localStorage.removeItem(KEY_STORAGE);
    setKey("");
    setState(null);
    setStatus("Locked");
  }

  if (!state) return <LoginGate busy={status === "Loading"} error={error} onUnlock={unlock} />;

  return (
    <AppShell
      active={active}
      activeProfile={profileId}
      profiles={state.profiles}
      appName={state.appName}
      disabled={!databaseReady}
      termName={state.schedule.term.name}
      onNavigate={setActive}
      onProfileChange={switchProfile}
      onLogout={logout}
      status={status}
    >
      {error && (
        <div
          className="mx-auto mb-4 max-w-[1420px] rounded-input border border-[color-mix(in_srgb,var(--danger)_35%,var(--line))] bg-[color-mix(in_srgb,var(--danger)_7%,var(--surface))] px-3 py-2.5 text-danger"
          role="alert"
        >
          {error}
        </div>
      )}
      {!databaseReady && <SetupView />}
      {databaseReady && active === "overview" && <OverviewView state={state} plan={plan} occurrences={displayOccurrences} accessKey={key} profileId={profileId} onNavigate={setActive} />}
      {databaseReady && active === "schedule" && <ScheduleView state={state} occurrences={displayOccurrences} onImport={importTimetable} />}
      {databaseReady && active === "compare" && <CompareView key={profileId} state={state} accessKey={key} />}
      {databaseReady && (active === "changes" || active === "notifications") && <ChangesAlertsView section={active} onSectionChange={setActive} state={state} accessKey={key} profileId={profileId} onSave={persist} />}
      {databaseReady && active === "misc" && <MiscView key={`${profileId}:${state.updatedAt}`} state={state} onSave={persist} />}
      {databaseReady && active === "settings" && <SettingsView key={`${profileId}:${state.updatedAt}`} state={state} onSave={persist} />}
    </AppShell>
  );
}

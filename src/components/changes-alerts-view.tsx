"use client";

import type { ClientState } from "@/lib/client-api";
import type { ProfileId } from "@/lib/types";
import { ChangesView } from "./changes-view";
import { NotificationsView } from "./notifications-view";
import { cx } from "./ui";

interface ChangesAlertsViewProps {
  section: "changes" | "notifications";
  onSectionChange: (section: "changes" | "notifications") => void;
  state: ClientState;
  accessKey: string;
  profileId: ProfileId;
  onSave: (state: ClientState) => Promise<void>;
}

export function ChangesAlertsView({ section, onSectionChange, state, accessKey, profileId, onSave }: ChangesAlertsViewProps) {
  return (
    <>
      <nav className="mx-auto mb-5 flex max-w-[1420px] gap-1 rounded-input border border-line bg-surface-subtle p-1 max-nav:mb-3.5" aria-label="Changes and alerts">
        <button
          type="button"
          className={cx("min-h-11 rounded-input px-4 text-[0.78rem] font-semibold transition-[background-color,color,box-shadow] duration-[130ms] hover:text-ink", section === "changes" ? "bg-surface text-ink shadow-sm" : "text-muted")}
          aria-pressed={section === "changes"}
          onClick={() => onSectionChange("changes")}
        >
          Schedule changes
        </button>
        <button
          type="button"
          className={cx("min-h-11 rounded-input px-4 text-[0.78rem] font-semibold transition-[background-color,color,box-shadow] duration-[130ms] hover:text-ink", section === "notifications" ? "bg-surface text-ink shadow-sm" : "text-muted")}
          aria-pressed={section === "notifications"}
          onClick={() => onSectionChange("notifications")}
        >
          Class alerts
        </button>
      </nav>
      {section === "changes"
        ? <ChangesView key={profileId} state={state} onSave={onSave} />
        : <NotificationsView key={`${profileId}:${state.updatedAt}`} state={state} accessKey={accessKey} profileId={profileId} onSave={onSave} />}
    </>
  );
}

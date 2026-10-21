"use client";

import type { ReactNode } from "react";
import { CalendarDays, CalendarX2, Columns3, Ellipsis, Gauge, LogOut, Settings2, UserRound } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Profile, ProfileId } from "@/lib/types";
import { BrandMark } from "./brand-mark";
import { cx, iconButton } from "./ui";

export type ViewId = "overview" | "schedule" | "compare" | "changes" | "notifications" | "misc" | "settings";

const items = [
  { id: "overview", label: "Today", mobileLabel: "Today", icon: Gauge },
  { id: "schedule", label: "Schedule", mobileLabel: "Schedule", icon: CalendarDays },
  { id: "compare", label: "Compare", mobileLabel: "Compare", icon: Columns3 },
  { id: "changes", label: "Changes & alerts", mobileLabel: "Changes", icon: CalendarX2 },
  { id: "misc", label: "Misc", mobileLabel: "Misc", icon: Ellipsis },
  { id: "settings", label: "Settings", mobileLabel: "Settings", icon: Settings2 },
] as const;

interface AppShellProps {
  active: ViewId;
  activeProfile: ProfileId;
  profiles: readonly Profile[];
  termName: string;
  appName: string;
  /** Navigation is locked until the database is connected. */
  disabled?: boolean;
  onNavigate: (view: ViewId) => void;
  onProfileChange: (profileId: ProfileId) => void;
  onLogout: () => void;
  status: string;
  children: ReactNode;
}

const navItem =
  "flex min-h-[42px] items-center gap-[11px] rounded-lg border-0 bg-transparent px-[11px] text-left text-[0.82rem] text-muted transition-[color,background-color] duration-[130ms] ease-out hover:bg-surface-strong hover:text-ink";
const bottomNavItem =
  "grid min-h-[52px] min-w-0 place-items-center content-center gap-[2px] rounded-lg border-0 bg-transparent px-0 text-[0.58rem] text-faint max-xs:text-[0.54rem] [&>span]:max-w-full [&>span]:truncate";
const profileSelect =
  "w-full min-w-0 cursor-pointer border-0 bg-transparent p-0 text-[0.75rem] font-semibold outline-0";

function SyncDot({ status }: { status: string }) {
  return <i className={cx("size-[7px] shrink-0 rounded-full", status === "Saved" ? "bg-success" : "bg-[#f59e0b]")} />;
}

export function AppShell({ active, activeProfile, profiles, termName, appName, disabled = false, onNavigate, onProfileChange, onLogout, status, children }: AppShellProps) {
  const reduceMotion = useReducedMotion();
  const activeItem = items.find((item) => item.id === (active === "notifications" ? "changes" : active)) ?? items[0];
  const isNavActive = (id: (typeof items)[number]["id"]) => active === id || (id === "changes" && active === "notifications");

  return (
    <div className="grid min-h-[100dvh] grid-cols-[var(--sidebar)_minmax(0,1fr)] max-nav:block max-nav:pb-[calc(68px+env(safe-area-inset-bottom))] max-nav:pt-[calc(54px+env(safe-area-inset-top))]">
      <aside
        className="fixed inset-y-0 left-0 z-20 flex w-[var(--sidebar)] flex-col border-r border-line bg-surface-subtle px-3 py-4 max-nav:hidden"
        aria-label="Main navigation"
      >
        <div className="flex items-center gap-[11px] px-[5px] pb-5 pt-[2px]">
          <BrandMark size="small" />
          <div className="grid min-w-0">
            <strong className="text-[0.82rem] font-[630]">{termName}</strong>
            <span className="text-[0.71rem] text-faint">{appName}</span>
          </div>
        </div>
        <label className="mb-3.5 grid min-h-12 grid-cols-[18px_minmax(0,1fr)] cursor-pointer items-center gap-[9px] rounded-input border border-line bg-surface px-[9px] py-[7px] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
          <UserRound aria-hidden="true" className="size-4 text-accent" />
          <span className="grid min-w-0">
            <small className="text-[0.61rem] leading-[1.1] text-faint">Profile</small>
            <select value={activeProfile} onChange={(event) => onProfileChange(event.target.value)} aria-label="Switch timetable profile" className={profileSelect}>
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </select>
          </span>
        </label>
        <nav className="grid gap-[3px]">
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={cx(navItem, isNavActive(id) && "bg-surface-strong font-semibold text-ink", disabled && "cursor-not-allowed opacity-45")}
              onClick={() => onNavigate(id)}
              disabled={disabled}
              aria-current={isNavActive(id) ? "page" : undefined}
            >
              <Icon aria-hidden="true" className={cx("size-[17px]", isNavActive(id) ? "text-accent" : "text-faint")} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line px-1 pt-3">
          <span className="flex items-center gap-[7px] text-[0.7rem] text-faint" aria-live="polite"><SyncDot status={status} />{status}</span>
          <button className={iconButton} type="button" onClick={onLogout} aria-label="Lock timetable"><LogOut aria-hidden="true" /></button>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 hidden h-[calc(54px+env(safe-area-inset-top))] grid-cols-[34px_minmax(0,1fr)_auto_12px] items-center gap-2 border-b border-line bg-surface px-3 pt-[env(safe-area-inset-top)] max-nav:grid">
        <BrandMark size="mini" />
        <div className="grid leading-[1.1]">
          <span className="text-[0.6rem] uppercase tracking-[0.06em] text-faint">{termName}</span>
          <strong className="text-[0.84rem]">{activeItem.mobileLabel}</strong>
        </div>
        <label className="flex min-h-11 min-w-20 items-center gap-[5px] rounded-input border border-line bg-surface-subtle px-[7px] focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-focus">
          <UserRound aria-hidden="true" className="size-3.5 shrink-0 text-accent" />
          <select value={activeProfile} onChange={(event) => onProfileChange(event.target.value)} aria-label="Switch timetable profile" className="w-full min-w-0 border-0 bg-transparent p-0 text-[0.69rem] font-semibold outline-0">
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
        </label>
        <span className="grid place-items-center" aria-label={status}><SyncDot status={status} /></span>
      </header>

      <main className="col-start-2 min-w-0 h-[100dvh] overflow-y-auto px-[clamp(20px,3vw,42px)] pb-12 pt-7 max-nav:col-start-1 max-nav:h-auto max-nav:min-h-[calc(100dvh-118px)] max-nav:overflow-visible max-nav:px-3.5 max-nav:pb-7 max-nav:pt-[18px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={reduceMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -3 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 hidden h-[calc(64px+env(safe-area-inset-bottom))] grid-cols-[repeat(6,1fr)] border-t border-line bg-surface px-[7px] pb-[env(safe-area-inset-bottom)] pt-[5px] max-nav:grid" aria-label="Main navigation">
        {items.map(({ id, mobileLabel, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={cx(bottomNavItem, isNavActive(id) && "bg-accent-soft text-accent-ink", disabled && "opacity-45")}
            onClick={() => onNavigate(id)}
            disabled={disabled}
            aria-current={isNavActive(id) ? "page" : undefined}
          >
            <Icon aria-hidden="true" className={cx("size-[19px]", isNavActive(id) && "text-accent-ink")} />
            <span>{mobileLabel}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

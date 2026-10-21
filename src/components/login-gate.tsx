"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { TextMorph } from "torph/react";
import { BrandMark } from "./brand-mark";
import { button, cx } from "./ui";

interface LoginGateProps {
  busy: boolean;
  error: string;
  onUnlock: (key: string) => void;
}

export function LoginGate({ busy, error, onUnlock }: LoginGateProps) {
  const [key, setKey] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (key.trim()) onUnlock(key.trim());
  }

  return (
    <main className="grid min-h-[100dvh] content-center place-items-center gap-[18px] bg-surface-subtle p-6 max-xs:p-3.5">
      <section
        className="grid w-[min(100%,408px)] gap-7 rounded-modal border border-line bg-surface p-8 shadow-float max-xs:p-6"
        aria-labelledby="login-title"
      >
        <BrandMark />
        <div>
          <p className="overline">Timetable</p>
          <h1 id="login-title" className="mt-2 text-[1.8rem]">Open your control room</h1>
          <p className="mt-2.5 text-muted">Enter the private access key once. It stays on this device.</p>
        </div>
        <form onSubmit={submit} className="grid gap-2.5">
          <label htmlFor="access-key" className="text-[0.75rem] font-[590] text-ink">Access key</label>
          <div className="relative [&_input]:pl-10 [&_svg]:absolute [&_svg]:left-3 [&_svg]:top-1/2 [&_svg]:-translate-y-1/2 [&_svg]:text-faint">
            <KeyRound aria-hidden="true" />
            <input
              id="access-key"
              type="password"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              autoComplete="current-password"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>
          {error && <p id="login-error" className="text-[0.78rem] text-danger" role="alert">{error}</p>}
          <button className={cx(button.primary, button.wide)} type="submit" disabled={busy || !key.trim()}>
            <TextMorph duration={180} respectReducedMotion>{busy ? "Checking…" : "Open timetable"}</TextMorph>
            {!busy && <ArrowRight aria-hidden="true" />}
          </button>
        </form>
      </section>
      <p className="text-xs text-faint">Schedule data stays in your private app storage.</p>
    </main>
  );
}

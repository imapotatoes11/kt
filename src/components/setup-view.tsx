import { Database } from "lucide-react";
import { cx, pageDescription, pageStack, panel } from "./ui";

/** Shown in place of every data view until DATABASE_URL points at a Neon database. */
export function SetupView() {
  return (
    <div className={pageStack}>
      <header>
        <p className="overline mb-[7px]">Setup</p>
        <h1>Connect a database</h1>
        <p className={pageDescription}>
          Schedules, settings, and alert history are stored in Neon Postgres. Everything else is disabled until a database is connected.
        </p>
      </header>
      <section className={cx(panel, "grid max-w-[640px] gap-3 p-5")} aria-labelledby="setup-steps">
        <div className="flex items-center gap-2.5"><Database aria-hidden="true" className="size-[18px] text-accent" /><h2 id="setup-steps">Steps</h2></div>
        <ol className="grid list-decimal gap-1.5 pl-5 text-[0.85rem] text-muted">
          <li>Create a project at neon.com and copy its connection string.</li>
          <li>Set it as <code>DATABASE_URL</code> in <code>.env.local</code> (or in your Vercel project’s environment variables).</li>
          <li>Restart the dev server or redeploy. The required table is created automatically.</li>
        </ol>
      </section>
    </div>
  );
}

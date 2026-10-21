"use client";

import { AlertTriangle } from "lucide-react";
import { button, statePage } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={statePage}>
      <AlertTriangle aria-hidden="true" />
      <h1>Something went wrong</h1>
      <p className="mb-2 text-muted">Your settings are safe. Reload the app and try again.</p>
      <button className={button.primary} type="button" onClick={reset}>Reload app</button>
    </main>
  );
}

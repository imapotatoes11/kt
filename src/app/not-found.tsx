import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { button, statePage } from "@/components/ui";

export default function NotFound() {
  return (
    <main className={statePage}>
      <MapPinOff aria-hidden="true" />
      <h1>Nothing scheduled here</h1>
      <p className="mb-2 text-muted">This page does not exist.</p>
      <Link className={button.primary} href="/">Back to timetable</Link>
    </main>
  );
}

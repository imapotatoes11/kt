import type { MetadataRoute } from "next";

import { appName } from "@/lib/env";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appName(),
    short_name: appName().slice(0, 12),
    description: "Personal timetable and notification control.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#18181b",
    orientation: "any",
    icons: [
      // PNG first: several installers still skip SVG entries outright.
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}

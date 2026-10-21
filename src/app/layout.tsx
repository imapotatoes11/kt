import "@fontsource-variable/chivo";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { appName } from "@/lib/env";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

export function generateMetadata(): Metadata {
  const name = appName();
  return {
    title: name,
    description: "Personal class schedule, walking, weather, and notification control.",
    applicationName: name,
    appleWebApp: { capable: true, statusBarStyle: "default", title: name },
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

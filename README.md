# Timetable

A self-hosted class timetable control room: next class, live class progress, temporary cancellations and moves, between-class gaps, weather-adjusted walking time, and ntfy push notifications. It is a responsive installable PWA, not a public landing page.

You bring the data: deploy it, connect a [Neon](https://neon.com) database, and import your schedule. The repository ships with no timetables or users.

## Setup

Requirements: Node.js 22+ and pnpm 11.

```bash
pnpm install
cp .env.example .env.local   # then fill it in
pnpm dev
```

Everything is configured through environment variables; see [`.env.example`](.env.example) for the full list.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon connection string. **Without it every data view is disabled** and the app shows setup steps. |
| `APP_ACCESS_KEY` / `APP_ACCESS_KEYS` | Key(s) used to sign in. |
| `APP_PROFILES` | `id:Name` list, e.g. `alex:Alex,sam:Sam`. Defaults to a single `me` profile. |
| `APP_NAME` | Name shown in the page title, installed app, and sidebar. |
| `CRON_SECRET` | Protects the daily notification cron. |
| `DEFAULT_TIMEZONE`, `DEFAULT_ORIGIN_*` | Defaults for new profiles' timezone and first-trip origin. |
| `NTFY_SERVER`, `NTFY_TOPIC`, `NTFY_TOPIC_<ID>` | ntfy server and per-profile topic seeds. |

In development, `timetable` is also accepted as an access key.

## Adding your timetable

Once the database is connected, open **Schedule** and paste or upload a schedule JSON. A profile's timetable can be replaced later from the same page; settings and temporary changes are kept (changes to meetings that no longer exist are dropped). The shape:

```json
{
  "term": { "id": "2026-fall", "name": "Fall 2026", "timezone": "America/Toronto", "startsOn": "2026-09-08", "endsOn": "2026-12-08", "closedRanges": [] },
  "source": { "label": "My timetable", "accurateAsOf": "2026-09-07", "file": "" },
  "courses": [{ "id": "abc101", "code": "ABC101", "name": "Intro", "color": "blue" }],
  "buildings": [{ "code": "MN", "name": "Main", "latitude": 43.5486, "longitude": -79.6619 }],
  "meetings": [{ "id": "abc101-mon", "courseId": "abc101", "day": 1, "startsAt": "10:00", "endsAt": "11:00", "section": "LEC0101", "building": "MN", "room": "1170", "mode": "in-person" }]
}
```

Weekdays use JavaScript numbering (`1` Monday through `5` Friday); times are local 24-hour `HH:mm`. Course colours: `blue`, `orange`, `rose`, `green`, `red`, `teal`, `purple`. Use `null` coordinates for TBA/online buildings; walking falls back to a five-minute estimate plus the door buffer.

Default notification and walking preferences live in [`data/default-settings.json`](data/default-settings.json) and are copied to each new profile.

## Notifications

The daily Vercel cron builds a rolling three-day alert window per profile and schedules messages directly on each profile's ntfy topic with deterministic sequence IDs. Saving settings, cancelling a class, or moving it re-syncs immediately. Treat a public ntfy.sh topic name like a password.

## Deploying to Vercel

Set the environment variables above (Neon's Vercel integration adds `DATABASE_URL` for you), then `pnpm vercel --prod`. [`vercel.json`](vercel.json) runs `/api/cron/tick` at 05:00 UTC daily.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

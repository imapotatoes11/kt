import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const notificationRule = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["leave", "before-start", "before-end"]),
  enabled: z.boolean(),
  minutes: z.number().int().min(0).max(180),
  label: z.string().min(1).max(120),
  includeWeather: z.boolean(),
  // Defaulted rather than required: rules saved before this flag existed are
  // still read back out of storage and sent here unchanged.
  delayedStart: z.boolean().default(false),
});

const superReminderOffset = z.union([
  z.literal(180),
  z.literal(120),
  z.literal(60),
  z.literal(30),
  z.literal(15),
  z.literal(10),
  z.literal(5),
]);

const superReminder = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(120),
  date: z.iso.date(),
  time,
  offsets: z.array(superReminderOffset).min(1).max(7)
    .refine((values) => new Set(values).size === values.length, "Choose each reminder time once"),
  createdAt: z.iso.datetime(),
});

export const mutableStateSchema = z.object({
  settings: z.object({
    ntfy: z.object({
      server: z.string().url().refine((value) => value.startsWith("https://"), "Use an HTTPS ntfy server"),
      topic: z.union([z.literal(""), z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Use 1–64 letters, numbers, dashes, or underscores")]),
      priority: z.number().int().min(1).max(5),
    }),
    notifications: z.object({
      enabled: z.boolean(),
      quietStart: time,
      quietEnd: time,
      rules: z.array(notificationRule).min(1).max(24),
    }),
    walking: z.object({
      originLabel: z.string().max(100),
      originLatitude: z.number().min(-90).max(90).nullable(),
      originLongitude: z.number().min(-180).max(180).nullable(),
      speedUnit: z.enum(["m/min", "km/h", "min/km"]),
      metersPerMinute: z.number().min(30).max(180),
      routeMultiplier: z.number().min(1).max(3),
      doorBufferMinutes: z.number().int().min(0).max(30),
      rainPenaltyMinutes: z.number().int().min(0).max(30),
      snowPenaltyMinutes: z.number().int().min(0).max(30),
      coldPenaltyMinutes: z.number().int().min(0).max(30),
      precipitationThreshold: z.number().int().min(0).max(100),
    }),
    display: z.object({
      theme: z.enum(["light", "dark", "system"]),
      accent: z.enum(["red", "orange", "yellow", "green", "blue", "purple", "pink"]).default("orange"),
      clock: z.enum(["12h", "24h"]),
      showCourseNames: z.boolean(),
      delayedStart: z.boolean().default(false),
      startOffsetMinutes: z.number().int().min(0).max(60).default(10),
    }),
  }),
  exceptions: z.array(z.object({
    id: z.string().min(1).max(100),
    meetingId: z.string().min(1).max(100),
    date: z.iso.date(),
    kind: z.enum(["cancelled", "moved"]),
    startsAt: time.optional(),
    endsAt: time.optional(),
    building: z.string().max(8).optional(),
    room: z.string().max(30).optional(),
    note: z.string().max(300),
    createdAt: z.iso.datetime(),
  })).max(300),
  superReminders: z.array(superReminder).max(100).default([]),
});

const hhmm = time;
const id = z.string().min(1).max(100);

export const scheduleSchema = z.object({
  term: z.object({
    id,
    name: z.string().min(1).max(100),
    timezone: z.string().min(1).max(60).refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Use an IANA timezone such as America/Toronto"),
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
    closedRanges: z.array(z.object({ startsOn: z.iso.date(), endsOn: z.iso.date(), label: z.string().max(120) })).max(60).default([]),
  }),
  source: z.object({
    label: z.string().max(120).default("Imported"),
    accurateAsOf: z.iso.date(),
    file: z.string().max(200).default(""),
  }),
  courses: z.array(z.object({
    id,
    code: z.string().min(1).max(60),
    name: z.string().max(160),
    color: z.enum(["blue", "orange", "rose", "green", "red", "teal", "purple"]),
  })).max(60),
  buildings: z.array(z.object({
    code: z.string().min(1).max(8),
    name: z.string().max(100),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
  })).max(200),
  meetings: z.array(z.object({
    id,
    courseId: id,
    day: z.number().int().min(1).max(5),
    startsAt: hhmm,
    endsAt: hhmm,
    section: z.string().max(30),
    building: z.string().max(8),
    room: z.string().max(30),
    mode: z.enum(["in-person", "online"]),
  })).max(300),
}).superRefine((schedule, context) => {
  const courses = new Set(schedule.courses.map((course) => course.id));
  const buildings = new Set(schedule.buildings.map((building) => building.code));
  schedule.meetings.forEach((meeting, index) => {
    if (!courses.has(meeting.courseId)) context.addIssue({ code: "custom", path: ["meetings", index, "courseId"], message: `Unknown course "${meeting.courseId}"` });
    if (!buildings.has(meeting.building)) context.addIssue({ code: "custom", path: ["meetings", index, "building"], message: `Unknown building "${meeting.building}"` });
    if (meeting.endsAt <= meeting.startsAt) context.addIssue({ code: "custom", path: ["meetings", index, "endsAt"], message: "Must end after it starts" });
  });
  if (schedule.term.endsOn < schedule.term.startsOn) context.addIssue({ code: "custom", path: ["term", "endsOn"], message: "Term ends before it starts" });
});

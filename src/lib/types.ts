export type AccentColor = "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink";

export type CourseColor = "blue" | "orange" | "rose" | "green" | "red" | "teal" | "purple";

export type ProfileId = string;

export interface Profile {
  id: ProfileId;
  name: string;
}

export interface Term {
  id: string;
  name: string;
  timezone: string;
  startsOn: string;
  endsOn: string;
  closedRanges: Array<{ startsOn: string; endsOn: string; label: string }>;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  color: CourseColor;
}

export interface Building {
  code: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export interface Meeting {
  id: string;
  courseId: string;
  day: number;
  startsAt: string;
  endsAt: string;
  section: string;
  building: string;
  room: string;
  mode: "in-person" | "online";
}

export interface Schedule {
  term: Term;
  source: { label: string; accurateAsOf: string; file: string };
  courses: Course[];
  buildings: Building[];
  meetings: Meeting[];
}

export type ExceptionKind = "cancelled" | "moved";

export interface ScheduleException {
  id: string;
  meetingId: string;
  date: string;
  kind: ExceptionKind;
  startsAt?: string;
  endsAt?: string;
  building?: string;
  room?: string;
  note: string;
  createdAt: string;
}

export type NotificationKind = "leave" | "before-start" | "before-end";

export const SUPER_REMINDER_OFFSETS = [180, 120, 60, 30, 15, 10, 5] as const;

export type SuperReminderOffset = typeof SUPER_REMINDER_OFFSETS[number];

export interface SuperReminder {
  id: string;
  title: string;
  date: string;
  time: string;
  offsets: SuperReminderOffset[];
  createdAt: string;
}

export interface NotificationRule {
  id: string;
  kind: NotificationKind;
  enabled: boolean;
  minutes: number;
  label: string;
  includeWeather: boolean;
  /** Fire relative to the UofT start time (posted start + 10 min). Start-based rules only. */
  uoftTime: boolean;
}

export interface Settings {
  ntfy: { server: string; topic: string; priority: number };
  notifications: {
    enabled: boolean;
    quietStart: string;
    quietEnd: string;
    rules: NotificationRule[];
  };
  walking: {
    originLabel: string;
    originLatitude: number;
    originLongitude: number;
    speedUnit: "m/min" | "km/h" | "min/km";
    metersPerMinute: number;
    routeMultiplier: number;
    doorBufferMinutes: number;
    rainPenaltyMinutes: number;
    snowPenaltyMinutes: number;
    coldPenaltyMinutes: number;
    precipitationThreshold: number;
  };
  display: {
    theme: "light" | "dark" | "system";
    accent: AccentColor;
    clock: "12h" | "24h";
    showCourseNames: boolean;
    /** Show class start times shifted to the UofT start (posted start + 10 min). */
    uoftTime: boolean;
  };
}

export interface DeliveryLogEntry {
  id: string;
  sentAt: string;
  title: string;
  message: string;
  status: "sent" | "scheduled" | "failed";
  error?: string;
}

export interface ScheduledNotification {
  id: string;
  sequenceId: string;
  dueAt: string;
  server: string;
  topic: string;
  priority: number;
  title: string;
  message: string;
}

export interface AppState {
  version: 1;
  updatedAt: string;
  schedule: Schedule;
  settings: Settings;
  exceptions: ScheduleException[];
  superReminders: SuperReminder[];
  scheduledNotifications: ScheduledNotification[];
  deliveryLog: DeliveryLogEntry[];
}

export interface Occurrence {
  id: string;
  date: string;
  meetingId: string;
  course: Course;
  startsAt: string;
  endsAt: string;
  start: string;
  end: string;
  section: string;
  building: Building;
  room: string;
  cancelled: boolean;
  moved: boolean;
  note: string;
}

export interface ScheduleGap {
  id: string;
  day: number;
  startsAt: string;
  endsAt: string;
  minutes: number;
  from: { courseCode: string; building: string; room: string };
  to: { courseCode: string; building: string; room: string };
}

/** A cancellation or move landing on this class's occurrence within the visible week. */
export interface TimelineException {
  kind: ExceptionKind;
  note: string;
  /** Only set for a move — the meeting's own values otherwise. */
  startsAt?: string;
  endsAt?: string;
  building?: string;
  room?: string;
}

export interface TimelineClass {
  kind: "class";
  meetingId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  color: CourseColor;
  section: string;
  building: string;
  room: string;
  startsAt: string;
  endsAt: string;
  startMinutes: number;
  endMinutes: number;
  minutes: number;
  exception?: TimelineException;
}

export interface TimelineGap {
  kind: "gap";
  id: string;
  startsAt: string;
  endsAt: string;
  startMinutes: number;
  endMinutes: number;
  minutes: number;
  changesBuilding: boolean;
  from: { courseCode: string; building: string; room: string };
  to: { courseCode: string; building: string; room: string };
}

export interface DayTimeline {
  day: number;
  classes: TimelineClass[];
  gaps: TimelineGap[];
  startMinutes: number | null;
  endMinutes: number | null;
  classMinutes: number;
  gapMinutes: number;
}

export interface WeekTimeline {
  days: DayTimeline[];
  rangeStartMinutes: number;
  rangeEndMinutes: number;
  totalClassMinutes: number;
  totalGapMinutes: number;
  longestGapMinutes: number;
  transitions: number;
}

export interface WeatherSnapshot {
  temperature: number;
  precipitationProbability: number;
  weatherCode: number;
  windSpeed: number;
  label: string;
}

export interface PlannedNotification {
  id: string;
  sequenceId: string;
  dueAt: string;
  kind: NotificationKind | "super-reminder";
  title: string;
  message: string;
  occurrenceId: string;
  walkMinutes?: number;
  weather?: WeatherSnapshot | null;
}

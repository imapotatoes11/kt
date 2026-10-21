import { createDefaultState } from "./defaults";
import type { AppState, Schedule } from "./types";

/** A small made-up timetable for tests; the app itself ships with no schedule data. */
export const fixtureSchedule: Schedule = {
  term: {
    id: "2026-fall",
    name: "Fall 2026",
    timezone: "America/New_York",
    startsOn: "2026-09-08",
    endsOn: "2026-12-08",
    closedRanges: [
      { startsOn: "2026-10-12", endsOn: "2026-10-12", label: "Thanksgiving" },
      { startsOn: "2026-10-26", endsOn: "2026-10-30", label: "Reading week" },
    ],
  },
  source: { label: "Test timetable", accurateAsOf: "2026-09-07", file: "" },
  courses: [
    { id: "mat101", code: "MATH101", name: "Calculus", color: "orange" },
    { id: "csc101", code: "CSCI101", name: "Programming", color: "blue" },
    { id: "eng101", code: "ENGL101", name: "Writing", color: "green" },
  ],
  buildings: [
    { code: "SH", name: "South Hall", latitude: 40.0, longitude: -100.0 },
    { code: "NH", name: "North Hall", latitude: 40.001, longitude: -100.0 },
    { code: "EH", name: "East Hall", latitude: 40.0, longitude: -99.999 },
  ],
  meetings: [
    { id: "mat101-lec-tue", courseId: "mat101", day: 2, startsAt: "09:00", endsAt: "11:00", section: "LEC0101", building: "NH", room: "200", mode: "in-person" },
    { id: "mat101-tut-tue", courseId: "mat101", day: 2, startsAt: "14:00", endsAt: "15:00", section: "TUT0101", building: "NH", room: "235", mode: "in-person" },
    { id: "csc101-lec-thu", courseId: "csc101", day: 4, startsAt: "10:00", endsAt: "11:30", section: "LEC0101", building: "SH", room: "1170", mode: "in-person" },
    { id: "eng101-sem-thu", courseId: "eng101", day: 4, startsAt: "11:30", endsAt: "12:30", section: "SEM0101", building: "EH", room: "2020", mode: "in-person" },
  ],
};

export function fixtureState(profileId = "me"): AppState {
  const state = createDefaultState(profileId);
  state.schedule = structuredClone(fixtureSchedule);
  return state;
}

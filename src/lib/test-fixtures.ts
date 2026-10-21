import { createDefaultState } from "./defaults";
import type { AppState, Schedule } from "./types";

/** A small made-up timetable for tests; the app itself ships with no schedule data. */
export const fixtureSchedule: Schedule = {
  term: {
    id: "2026-fall",
    name: "Fall 2026",
    timezone: "America/Toronto",
    startsOn: "2026-09-08",
    endsOn: "2026-12-08",
    closedRanges: [
      { startsOn: "2026-10-12", endsOn: "2026-10-12", label: "Thanksgiving" },
      { startsOn: "2026-10-26", endsOn: "2026-10-30", label: "Reading week" },
    ],
  },
  source: { label: "Test timetable", accurateAsOf: "2026-09-07", file: "" },
  courses: [
    { id: "mat101", code: "MAT101H5 F", name: "Calculus", color: "orange" },
    { id: "csc101", code: "CSC101H5 F", name: "Programming", color: "blue" },
    { id: "eng101", code: "ENG101H5 F", name: "Writing", color: "green" },
  ],
  buildings: [
    { code: "MN", name: "Main", latitude: 43.54863, longitude: -79.66193 },
    { code: "IB", name: "Instruction", latitude: 43.54956, longitude: -79.66371 },
    { code: "DH", name: "Deerfield", latitude: 43.54785, longitude: -79.66172 },
  ],
  meetings: [
    { id: "mat101-lec-tue", courseId: "mat101", day: 2, startsAt: "09:00", endsAt: "11:00", section: "LEC0101", building: "IB", room: "200", mode: "in-person" },
    { id: "mat101-tut-tue", courseId: "mat101", day: 2, startsAt: "14:00", endsAt: "15:00", section: "TUT0101", building: "IB", room: "235", mode: "in-person" },
    { id: "csc101-lec-thu", courseId: "csc101", day: 4, startsAt: "10:00", endsAt: "11:30", section: "LEC0101", building: "MN", room: "1170", mode: "in-person" },
    { id: "eng101-sem-thu", courseId: "eng101", day: 4, startsAt: "11:30", endsAt: "12:30", section: "SEM0101", building: "DH", room: "2020", mode: "in-person" },
  ],
};

export function fixtureState(profileId = "me"): AppState {
  const state = createDefaultState(profileId);
  state.schedule = structuredClone(fixtureSchedule);
  return state;
}

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DayTrack } from "./day-timeline";

describe("day timeline current-time indicator", () => {
  it("positions the line on the shared time axis and gives it a non-colour label", () => {
    const markup = renderToStaticMarkup(
      <DayTrack
        day={undefined}
        marks={[]}
        totalHeight={480}
        offset={(minutes) => minutes - 9 * 60}
        timeText={(value) => value}
        currentTime={{ minutes: 10 * 60 + 30, label: "10:30 a.m." }}
      />,
    );

    expect(markup).toContain('class="gap-now"');
    expect(markup).toContain('style="top:90px"');
    expect(markup).toContain('aria-label="Current time: 10:30 a.m."');
    expect(markup).toContain("Now · 10:30 a.m.");
  });
});

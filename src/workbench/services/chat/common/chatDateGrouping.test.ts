import { describe, expect, it } from "vitest";
import { groupSessionsByDate } from "./chatDateGrouping";

describe("groupSessionsByDate", () => {
  it("groups items correctly into today, yesterday, last7Days and older", () => {
    const now = new Date("2026-08-17T12:00:00Z").getTime();
    const DAY_MS = 24 * 60 * 60 * 1000;

    const items = [
      { id: "1", updatedAt: now - 1000 }, // today
      { id: "2", updatedAt: now - DAY_MS }, // yesterday
      { id: "3", updatedAt: now - 3 * DAY_MS }, // last 7 days
      { id: "4", updatedAt: now - 40 * DAY_MS }, // older
    ];

    const groups = groupSessionsByDate(items, "last_updated", now);
    expect(groups.length).toBe(4);
    expect(groups[0].labelId).toBe("today");
    expect(groups[0].items.length).toBe(1);
    expect(groups[1].labelId).toBe("yesterday");
    expect(groups[2].labelId).toBe("last7Days");
    expect(groups[3].labelId).toBe("older");
  });
});

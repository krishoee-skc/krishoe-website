import { describe, expect, it } from "vitest";
import {
  normalizeFactoryOfflineDraft,
  parseFactoryOfflineDrafts,
} from "@/lib/factory-offline";

const draft = {
  id: " draft-1 ",
  assignmentId: " assignment-1 ",
  createdAt: "2026-07-26T08:00:00.000Z",
  remarks: " completed first run ",
  sizes: [
    { size: " 36 ", goodPairs: 9.6, rejectPairs: -2, reworkPairs: 1.2 },
    { size: "37", goodPairs: 0, rejectPairs: 0, reworkPairs: 0 },
  ],
};

describe("Factory offline production drafts", () => {
  it("normalizes whole-pair values and removes empty size rows", () => {
    expect(normalizeFactoryOfflineDraft(draft)).toEqual({
      id: "draft-1",
      assignmentId: "assignment-1",
      createdAt: "2026-07-26T08:00:00.000Z",
      remarks: "completed first run",
      sizes: [
        { size: "36", goodPairs: 10, rejectPairs: 0, reworkPairs: 1 },
      ],
    });
  });

  it("returns an empty queue for invalid device data", () => {
    expect(parseFactoryOfflineDrafts("{broken")).toEqual([]);
    expect(parseFactoryOfflineDrafts(JSON.stringify({ draft }))).toEqual([]);
  });

  it("drops incomplete and duplicate queue records", () => {
    const incomplete = { ...draft, id: "", sizes: [] };
    const parsed = parseFactoryOfflineDrafts(
      JSON.stringify([draft, draft, incomplete]),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.id).toBe("draft-1");
  });
});

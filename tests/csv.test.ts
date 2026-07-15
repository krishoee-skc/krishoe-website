import { describe, expect, it } from "vitest";
import { csvEscape, csvRecords, parseCsv, toCsv } from "@/lib/csv";

describe("csvEscape", () => {
  it("wraps values in quotes", () => {
    expect(csvEscape("hello")).toBe('"hello"');
    expect(csvEscape(42)).toBe('"42"');
  });

  it("doubles embedded quotes", () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });
});

describe("toCsv", () => {
  it("builds a header row plus data rows", () => {
    const csv = toCsv(["Name", "Price"], [["Sandal", 1999], ["Heel", 2499]]);
    expect(csv).toBe('"Name","Price"\n"Sandal","1999"\n"Heel","2499"');
  });

  it("escapes commas and newlines inside cells via quoting", () => {
    const csv = toCsv(["Note"], [["a,b\nc"]]);
    expect(csv).toBe('"Note"\n"a,b\nc"');
  });
});

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("handles quoted cells with commas and escaped quotes", () => {
    expect(parseCsv('"a,b","c ""d"""')).toEqual([["a,b", 'c "d"']]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("preserves newlines inside quoted cells", () => {
    expect(parseCsv('"line1\nline2",x')).toEqual([["line1\nline2", "x"]]);
  });

  it("is the inverse of toCsv for tricky values", () => {
    const rows = [["a,b", 'c "d"', "line1\nline2"]];
    const csv = toCsv(["c1", "c2", "c3"], rows);
    const parsed = parseCsv(csv);
    expect(parsed[0]).toEqual(["c1", "c2", "c3"]);
    expect(parsed[1]).toEqual(["a,b", 'c "d"', "line1\nline2"]);
  });
});

describe("csvRecords", () => {
  it("maps rows to objects keyed by header", () => {
    const records = csvRecords('"Name","Price"\n"Sandal","1999"');
    expect(records).toEqual([{ Name: "Sandal", Price: "1999" }]);
  });

  it("skips fully empty rows", () => {
    const records = csvRecords("Name,Price\nSandal,1999\n,\n");
    expect(records).toEqual([{ Name: "Sandal", Price: "1999" }]);
  });

  it("returns an empty array when there is no header", () => {
    expect(csvRecords("")).toEqual([]);
  });
});

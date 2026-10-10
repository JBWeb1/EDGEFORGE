import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isValidTimeZone, startOfZonedDay, zonedParts, zonedTimeToUtc } from "./timezone";

describe("zonedParts", () => {
  it("gives the local date, weekday and hour", () => {
    // 2026-03-02 23:30 UTC is Tuesday 01:30 in Johannesburg (UTC+2).
    const p = zonedParts(new Date("2026-03-02T23:30:00Z"), "Africa/Johannesburg");
    assert.equal(p.date, "2026-03-03");
    assert.equal(p.weekday, 2);
    assert.equal(p.hour, 1);
  });
  it("handles midnight as hour 0", () => {
    assert.equal(zonedParts(new Date("2026-03-02T00:00:00Z"), "UTC").hour, 0);
  });
});

describe("zonedTimeToUtc", () => {
  it("converts fixed-offset zones", () => {
    assert.equal(zonedTimeToUtc(2026, 3, 2, 9, 0, 0, 0, "Africa/Johannesburg").toISOString(), "2026-03-02T07:00:00.000Z");
  });
  it("follows daylight saving time", () => {
    // New York: EST (UTC-5) in January, EDT (UTC-4) in July.
    assert.equal(zonedTimeToUtc(2026, 1, 15, 9, 30, 0, 0, "America/New_York").toISOString(), "2026-01-15T14:30:00.000Z");
    assert.equal(zonedTimeToUtc(2026, 7, 15, 9, 30, 0, 0, "America/New_York").toISOString(), "2026-07-15T13:30:00.000Z");
  });
  it("picks the earlier instant for an ambiguous fall-back time", () => {
    // 2026-11-01 01:30 happens twice in New York; the first is EDT (UTC-4).
    assert.equal(zonedTimeToUtc(2026, 11, 1, 1, 30, 0, 0, "America/New_York").toISOString(), "2026-11-01T05:30:00.000Z");
  });
  it("moves forward across a spring-forward gap", () => {
    // 2026-03-08 02:30 doesn't exist in New York; it becomes 03:30 EDT.
    assert.equal(zonedTimeToUtc(2026, 3, 8, 2, 30, 0, 0, "America/New_York").toISOString(), "2026-03-08T07:30:00.000Z");
  });
  it("round-trips through zonedParts", () => {
    const d = zonedTimeToUtc(2026, 10, 25, 2, 15, 0, 0, "Europe/London");
    const p = zonedParts(d, "Europe/London");
    assert.deepEqual([p.date, p.hour, p.minute], ["2026-10-25", 2, 15]);
  });
});

describe("startOfZonedDay", () => {
  it("returns local midnight", () => {
    assert.equal(startOfZonedDay(new Date("2026-03-02T23:30:00Z"), "Africa/Johannesburg").toISOString(), "2026-03-02T22:00:00.000Z");
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects junk", () => {
    assert.equal(isValidTimeZone("Africa/Johannesburg"), true);
    assert.equal(isValidTimeZone("Mars/Olympus"), false);
  });
});

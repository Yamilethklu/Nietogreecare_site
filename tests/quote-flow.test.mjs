import test from "node:test";
import assert from "node:assert/strict";

import { isDateCoveredForCity } from "../src/lib/service-schedule.ts";

test("calendar coverage only allows configured cities on their service days", () => {
  assert.equal(isDateCoveredForCity("2026-09-28", "Georgetown"), true);
  assert.equal(isDateCoveredForCity("2026-09-28", "Leander"), false);
  assert.equal(isDateCoveredForCity("2026-09-30", " cedar park "), true);
  assert.equal(isDateCoveredForCity("2026-10-02", "Hutto"), true);
  assert.equal(isDateCoveredForCity("2026-10-02", "Cedar Park"), false);
});

test("calendar coverage rejects invalid or out-of-route dates", () => {
  assert.equal(isDateCoveredForCity("2026-02-30", "Georgetown"), false);
  assert.equal(isDateCoveredForCity("not-a-date", "Georgetown"), false);
  assert.equal(isDateCoveredForCity("2026-10-03", "Hutto"), false);
});

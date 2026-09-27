import test from 'node:test';
import assert from 'node:assert/strict';
import { futureVisits, nextSlot, addDays } from '../src/lib/operations/schedule.ts';

test('weekly and bi-weekly plans keep calendar dates across US daylight saving transitions', () => {
  assert.equal(addDays('2026-10-31', 7), '2026-11-07');
  assert.deepEqual(futureVisits({first_date:'2026-10-31',cadence:'bi_weekly'},[], 'plan','2026-11-30','2026-10-31'),['2026-10-31','2026-11-14','2026-11-28']);
  assert.deepEqual(futureVisits({first_date:'2026-10-31',cadence:'weekly'},[], 'plan','2026-11-14','2026-10-31'),['2026-10-31','2026-11-07','2026-11-14']);
});

test('old plans jump forward and never recreate existing visits', () => {
  const existing=[{plan_id:'plan',service_date:'2026-10-05'}];
  assert.deepEqual(futureVisits({first_date:'2024-01-01',cadence:'weekly'},existing,'plan','2026-10-19','2026-10-01'),['2026-10-12','2026-10-19']);
});

test('appointments do not overlap for a worker and reject an overbooked day', () => {
  const occupied=[{service_date:'2026-10-05',start_time:'08:00:00',duration_minutes:90,crew_member_id:'crew-1',status:'scheduled'}];
  assert.equal(nextSlot('2026-10-05','08:00',60,'crew-1',occupied).start_time,'09:30:00');
  assert.equal(nextSlot('2026-10-05','08:00',60,'crew-2',occupied).start_time,'08:00:00');
  assert.throws(()=>nextSlot('2026-10-05','17:00',120,'crew-1',occupied),/No queda tiempo/);
});

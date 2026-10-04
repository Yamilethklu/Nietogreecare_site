import test from 'node:test';
import assert from 'node:assert/strict';
import { matchMowRate } from '../src/lib/instant-pricing';
const rules = [
 { id:'weekly', service_key:'lawn_weekly', min_sq_ft:0, max_sq_ft:4000, price:30 },
 { id:'biweekly', service_key:'lawn_bi_weekly', min_sq_ft:0, max_sq_ft:4000, price:40 },
];
test('uses the owner price for the selected frequency',()=>{
 assert.equal(matchMowRate(rules,2189,'weekly')?.price,30);
 assert.equal(matchMowRate(rules,2189,'bi_weekly')?.price,40);
});
test('never invents a rate outside owner configured ranges',()=>{
 assert.equal(matchMowRate([],2189,'weekly'),null);
 assert.equal(matchMowRate(rules,4000,'weekly'),null);
 assert.equal(matchMowRate(rules,0,'weekly'),null);
});
test('owner edits apply to subsequent quotes',()=>{
 assert.equal(matchMowRate([{...rules[0],price:25}],2189,'weekly')?.price,25);
});

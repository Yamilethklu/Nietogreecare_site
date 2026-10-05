import test from 'node:test';
import assert from 'node:assert/strict';
import { SERVICE_CITIES, SERVICE_ZIP_CODES, ZIP_CITY_MAP } from '../src/lib/constants';
import { CITY_COUNTY_MAP, countyFromCity, countyFromGeocodeName, parcelLookupOrder } from '../src/lib/county-coverage';

test('every service city maps to a county', () => {
  for (const city of SERVICE_CITIES) assert.ok(CITY_COUNTY_MAP[city], city);
  assert.equal(countyFromCity('austin'), 'travis');
  assert.equal(countyFromCity('Hutto'), 'williamson');
});

test('geocode county names are normalized', () => {
  assert.equal(countyFromGeocodeName('Travis County'), 'travis');
  assert.equal(countyFromGeocodeName('Williamson'), 'williamson');
  assert.equal(countyFromGeocodeName('Nowhere County'), null);
});

test('parcel lookup tries detected county first and never excludes others', () => {
  assert.deepEqual(parcelLookupOrder('travis'), ['travis', 'williamson']);
  assert.deepEqual(parcelLookupOrder(null), ['williamson', 'travis']);
});

test('covered ZIPs map to covered cities', () => {
  for (const zip of SERVICE_ZIP_CODES) assert.ok(SERVICE_CITIES.includes(ZIP_CITY_MAP[zip] as never), zip);
});

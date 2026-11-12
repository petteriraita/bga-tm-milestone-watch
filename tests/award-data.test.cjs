const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the actual extension data reader without loading BGA or the UI.
let source = fs.readFileSync(require('node:path').join(__dirname, '..', 'content.js'), 'utf8');
source = source.replace("  window.setInterval(update, CHECK_INTERVAL_MS);", "  globalThis.testRead = getWatchData;\n  window.setInterval(update, CHECK_INTERVAL_MS);");
const trackers = {};
const document = {
  getElementById(id) { return trackers[id] || null; },
  querySelector() { return null; },
  addEventListener() {}, dispatchEvent() {},
};
const context = {document, Event: class {}, window: {setInterval() {}}, console};
vm.createContext(context);
vm.runInContext(source, context);

const maps = [
  ['Landlord', 'Banker', 'Scientist', 'Thermalist', 'Miner'],
  ['Cultivator', 'Magnate', 'Space Baron', 'Eccentric', 'Contractor'],
  ['Celebrity', 'Industrialist', 'Desert Settler', 'Estate Dealer', 'Benefactor'],
  ['Traveller', 'Landscaper', 'Highlander', 'Promoter', 'Blacksmith'],
];
for (const names of maps) {
  const token_types = {milestone_1: {name: 'Example', min: 3, num: 1}};
  const info = {};
  names.forEach((name, i) => { const id = `award_${i + 1}`; token_types[id] = {name, num: i + 1, r: name === 'Benefactor' ? 'tr' : name === 'Miner' ? 's+u' : 'complex'}; info[id] = {counter: i + 2, vp: 5, q: 0}; });
  context.gameui = {player_id: 1, gamedatas: {players: {'1': {name: 'You', color: 'ff0000'}, '2': {name: 'Them', color: '008000'}}, token_types}, cachedProgressTable: {'1': {operations: [{type: 'fund', args: {info}}]}, '2': {operations: [{type: 'fund', args: {info}}]}}};
  const rows = context.testRead().awardRows;
  assert.equal(rows.length, 2);
  assert.deepEqual(Array.from(rows[0].awards, a => a.name), names);
  assert.deepEqual(Array.from(rows[0].awards, a => a.counter), [2, 3, 4, 5, 6]);
  delete context.gameui.cachedProgressTable['2'];
  const missing = context.testRead().awardRows;
  assert.equal(missing.length, 2, 'missing progress must not drop a player');
  assert.equal(missing[1].awards[0].counter, null, 'missing is unknown, not zero');
  if (names.includes('Miner')) {
    trackers.tracker_s_ff0000 = {dataset: {state: '4'}};
    trackers.tracker_u_ff0000 = {dataset: {state: '3'}};
    assert.equal(context.testRead().awardRows[0].awards[4].counter, 7, 'Miner sums live steel and titanium');
    delete trackers.tracker_s_ff0000; delete trackers.tracker_u_ff0000;
  }
  if (names.includes('Benefactor')) {
    trackers.tracker_tr_ff0000 = {dataset: {state: '27'}};
    assert.equal(context.testRead().awardRows[0].awards[4].counter, 27, 'Benefactor follows live TR');
    delete trackers.tracker_tr_ff0000;
    assert.equal(context.testRead().awardRows[0].awards[4].counter, 6, 'falls back to BGA counter');
  }
}
console.log('Award data: four maps, all 20 awards, missing players, and Benefactor live-TR fallback passed.');

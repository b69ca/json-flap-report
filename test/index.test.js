import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, flatten } from '../src/index.js';

test('detects values returning to an earlier state', () => {
  const report = analyze([{ mode: 'home' }, { mode: 'away' }, { mode: 'home' }]);
  assert.equal(report.fields[0].path, '/mode');
  assert.equal(report.fields[0].changes, 2);
  assert.equal(report.fields[0].flaps, 1);
});

test('detects presence and type flapping', () => {
  const report = analyze([{ x: 1 }, {}, { x: 1 }, { x: '1' }]);
  assert.deepEqual(report.fields[0].events.map(event => event.kind), ['removed', 'added', 'type-changed']);
  assert.equal(report.fields[0].flaps, 1);
});

test('supports nested state and ignored paths', () => {
  const report = analyze([
    { at: 'a', state: { stable: true, noisy: 1 } },
    { at: 'b', state: { stable: true, noisy: 2 } }
  ], { statePath: 'state', timePath: 'at', ignore: ['/noisy'] });
  assert.equal(report.changedFieldCount, 0);
});

test('fingerprints object keys canonically inside arrays', () => {
  assert.deepEqual(flatten([{ b: 2, a: 1 }]), flatten([{ a: 1, b: 2 }]));
});

test('requires snapshot history', () => assert.throws(() => analyze([{}]), /at least two/));

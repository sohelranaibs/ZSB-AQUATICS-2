import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNiceScale,
  buildMonotonePath,
  buildMonotoneAreaPath,
  buildDonutSlicePath,
} from './svgChartMath';

test('computeNiceScale handles zero-only datasets cleanly', () => {
  const scale = computeNiceScale([0, 0, 0]);
  assert.equal(scale.min, 0);
  assert.ok(scale.max > 0);
  assert.ok(scale.ticks.length >= 2);
});

test('computeNiceScale covers positive and negative values with zero included', () => {
  const scale = computeNiceScale([-1200, 4800, 9500]);
  assert.ok(scale.min <= -1200);
  assert.ok(scale.max >= 9500);
  assert.ok(scale.ticks.includes(0));
});

test('computeNiceScale respects fixedDomain', () => {
  const scale = computeNiceScale([12, 88], { fixedDomain: [0, 100], tickCount: 5 });
  assert.equal(scale.min, 0);
  assert.equal(scale.max, 100);
  assert.deepEqual(scale.ticks, [0, 25, 50, 75, 100]);
});

test('buildMonotonePath and buildMonotoneAreaPath produce valid SVG commands', () => {
  const pts = [
    { x: 0, y: 100 },
    { x: 50, y: 40 },
    { x: 100, y: 60 },
  ];
  const line = buildMonotonePath(pts);
  assert.ok(line.startsWith('M 0.00 100.00 C '));
  const area = buildMonotoneAreaPath(pts, 120);
  assert.ok(area.endsWith('L 100.00 120.00 L 0.00 120.00 Z'));
});

test('buildDonutSlicePath handles full-circle single slice without NaN', () => {
  const path = buildDonutSlicePath(100, 100, 60, 90, 0, 360);
  assert.ok(path.startsWith('M '));
  assert.ok(path.endsWith('Z'));
  assert.ok(!path.includes('NaN'));
});

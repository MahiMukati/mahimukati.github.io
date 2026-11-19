'use strict';

// Run with: node --test scripts/test-lake-motion.cjs
// These tests exercise the renderer-independent numerical contract. Browser
// checks still cover visual density, drag behavior, and frame scheduling.
const assert = require('node:assert/strict');
const test = require('node:test');
const { LakeMotion } = require('../dist/assets/lake-motion.js');

const MAX_DISPLACEMENT = 26;
const magnitude = vector => Math.hypot(vector[0], vector[1]);

function field(motion, x, y, now) {
  const out = new Float64Array(2);
  motion.prepare(now);
  motion.target(x, y, now, out);
  assert.ok(Number.isFinite(out[0]) && Number.isFinite(out[1]), 'field must remain finite');
  assert.ok(magnitude(out) <= MAX_DISPLACEMENT + 1e-6, 'field must respect its displacement bound');
  return out;
}

test('a sparse, fast swipe influences the entire crossed path', () => {
  const motion = new LakeMotion();
  motion.move(0, 0, 1000);
  motion.move(600, 0, 1008);
  motion.leave();

  // Offset the probes from the centerline, where a radial field can be zero.
  // The three probes are all beyond a local endpoint-only influence radius.
  for (const x of [150, 300, 450]) {
    assert.ok(magnitude(field(motion, x, 24, 1009)) > 0.1,
      `the swipe must not leave a gap at x=${x}`);
  }
});

test('event density cannot accumulate unbounded force along the same swipe', () => {
  const middleTargets = [];
  for (const samples of [2, 20, 200]) {
    const motion = new LakeMotion();
    for (let index = 0; index < samples; index++) {
      // Equal timestamps isolate event density from trail aging.
      motion.move(600 * index / (samples - 1), 0, 1000);
    }
    motion.leave();
    middleTargets.push(field(motion, 300, 24, 1001));
    for (let x = 0; x <= 600; x += 20) {
      for (const y of [-48, -24, 24, 48]) field(motion, x, y, 1001);
    }
  }
  for (const target of middleTargets) {
    assert.ok(magnitude(target) > 0.1, 'dense event streams must preserve the interior wake');
    assert.ok(Math.hypot(target[0] - middleTargets[0][0], target[1] - middleTargets[0][1]) <= 3,
      'the same path must respond similarly with 2, 20, or 200 events');
  }
});

test('leaving preserves a soft lingering wake, and expired trails and reset clear it', () => {
  const motion = new LakeMotion();
  motion.move(0, 0, 1000);
  motion.move(600, 0, 1008);
  motion.leave();
  assert.ok(magnitude(field(motion, 300, 24, 1010)) > 0.1, 'leave must not abruptly erase the wake');
  assert.ok(magnitude(field(motion, 300, 24, 1250)) > 5, 'the wake must remain visible after a quarter second');
  assert.equal(magnitude(field(motion, 300, 24, 1700)), 0, 'the wake must expire after the history window');

  motion.move(300, 0, 1800);
  assert.ok(magnitude(field(motion, 300, 24, 1801)) > 0.1);
  motion.reset();
  assert.equal(magnitude(field(motion, 300, 24, 1802)), 0, 'reset must clear pointer and trail state');
});

test('a lingering trail blends smoothly into a stationary cursor', () => {
  const motion = new LakeMotion();
  motion.move(0, 0, 1000);
  motion.move(600, 0, 1008);
  let previous = field(motion, 580, 24, 1008);
  for (let now = 1016; now <= 1656; now += 8) {
    const current = field(motion, 580, 24, now);
    assert.ok(Math.hypot(current[0] - previous[0], current[1] - previous[1]) < 1,
      'the trailing current must fade into hover without a sudden jump');
    previous = current;
  }
});

function staticResponse(intervals) {
  const motion = new LakeMotion();
  const offset = new Float32Array([99, 98, -8, 4]);
  const velocity = new Float32Array([97, 96, 3, -2]);
  for (const seconds of intervals) motion.step(offset, velocity, 2, 11, -6, seconds);
  assert.deepEqual(Array.from(offset.subarray(0, 2)), [99, 98], 'step must only update the requested particle');
  assert.deepEqual(Array.from(velocity.subarray(0, 2)), [97, 96]);
  return [offset[2], offset[3], velocity[2], velocity[3]];
}

test('the damped spring has the same response at different frame rates', () => {
  const reference = staticResponse([1]);
  const schedules = [
    ...[30, 60, 120].map(fps => Array(fps).fill(1 / fps)),
    [0.1, 0.15, 0.05, 0.2, 0.5],
  ];
  for (const schedule of schedules) {
    const actual = staticResponse(schedule);
    for (let component = 0; component < actual.length; component++) {
      assert.ok(Math.abs(actual[component] - reference[component]) < 0.0002,
        `spring component ${component} must be independent of frame subdivision`);
    }
  }
});

function movingResponse(fps, includeStall) {
  const motion = new LakeMotion();
  const offset = new Float32Array(2);
  const velocity = new Float32Array(2);
  let elapsed = 0;
  let left = false;
  let stalled = false;
  let peak = 0;
  motion.move(0, 0, 1000);
  while (elapsed < 1600) {
    let milliseconds = Math.min(1000 / fps, 1600 - elapsed);
    if (includeStall && !stalled && elapsed >= 100) {
      milliseconds = 150;
      stalled = true;
    }
    elapsed += milliseconds;
    if (elapsed <= 250) motion.move(elapsed / 250 * 600, 0, 1000 + elapsed);
    else if (!left) {
      // Complete the same full sweep, even when a delayed frame crosses its end.
      motion.move(600, 0, 1250);
      motion.leave();
      left = true;
    }
    const target = field(motion, 300, 24, 1000 + elapsed);
    motion.step(offset, velocity, 0, target[0], target[1], milliseconds / 1000);
    for (const value of [...offset, ...velocity]) assert.ok(Number.isFinite(value), 'a long frame must not destabilize the spring');
    peak = Math.max(peak, magnitude(offset));
    assert.ok(magnitude(offset) <= MAX_DISPLACEMENT, 'motion must stay softly bounded through a delayed frame');
  }
  assert.ok(peak > 0.1, 'the simulation must actually exercise moving particles');
  assert.ok(magnitude(offset) < 0.05, 'the particles must return home after the trail expires');
  assert.ok(magnitude(velocity) < 0.1, 'the particles must finish settling');
}

test('fast swipes recover at 30/60/120 fps, including a 150ms frame gap', () => {
  for (const fps of [30, 60, 120]) {
    movingResponse(fps, false);
    movingResponse(fps, true);
  }
});

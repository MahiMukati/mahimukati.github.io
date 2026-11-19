/* Continuous pointer paths and time-based motion, shared with the regression checks. */
(function (root) {
  'use strict';
  class LakeMotion {
    constructor(radius = 112) {
      this.radius = radius;
      this.history = 520;
      this.limit = 26;
      this.omega = 13;
      this.segments = [];
      this.active = false;
      this.timeStep = -1;
    }
    move(x, y, time) {
      if (this.active) {
        const dx = x - this.x, dy = y - this.y;
        const length = Math.hypot(dx, dy);
        if (length > 0.1) {
          const seconds = Math.max(0.001, (time - this.time) / 1000);
          const speed = Math.min(1, length / seconds / 900);
          const previous = this.segments[this.segments.length - 1];
          // Collinear samples describe one stroke, regardless of device event rate.
          if (previous && time - previous.start < 45 && previous.ux * dx / length + previous.uy * dy / length > 0.995) {
            previous.bx = x; previous.by = y; previous.time = time;
            previous.speed = Math.max(previous.speed, speed);
          } else {
            this.segments.push({ ax: this.x, ay: this.y, bx: x, by: y, ux: dx / length, uy: dy / length, speed, start: this.time, time });
          }
          if (this.segments.length > 64) this.segments.shift();
        }
      }
      this.x = x; this.y = y; this.time = time; this.active = true;
    }
    leave() { this.active = false; }
    reset() { this.active = false; this.segments.length = 0; }
    prepare(now) {
      while (this.segments.length && now - this.segments[0].time >= this.history) this.segments.shift();
      const radius = this.radius;
      for (const s of this.segments) {
        const age = Math.max(0, (now - s.time) / this.history);
        const fade = Math.max(0, Math.min(1, (age - 0.25) / 0.75));
        s.life = 1 - fade * fade * (3 - 2 * fade);
        s.dx = s.bx - s.ax; s.dy = s.by - s.ay;
        s.inverseLength = 1 / (s.dx * s.dx + s.dy * s.dy);
        s.left = Math.min(s.ax, s.bx) - radius; s.right = Math.max(s.ax, s.bx) + radius;
        s.top = Math.min(s.ay, s.by) - radius; s.bottom = Math.max(s.ay, s.by) + radius;
      }
    }
    target(x, y, now, out) {
      const radius = this.radius, radiusSquared = radius * radius;
      let best = 0, targetX = 0, targetY = 0, hoverX = 0, hoverY = 0;
      if (this.active) {
        const dx = x - this.x, dy = y - this.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < radiusSquared) {
          const weight = (1 - distanceSquared / radiusSquared) ** 3;
          hoverX = dx / radius * 16 * weight;
          hoverY = dy / radius * 16 * weight;
        }
      }
      for (let i = 0; i < this.segments.length; i++) {
        const s = this.segments[i];
        if (x < s.left || x > s.right || y < s.top || y > s.bottom) continue;
        const t = Math.max(0, Math.min(1, ((x - s.ax) * s.dx + (y - s.ay) * s.dy) * s.inverseLength));
        const dx = x - s.ax - s.dx * t, dy = y - s.ay - s.dy * t;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared >= radiusSquared) continue;
        const weight = (1 - distanceSquared / radiusSquared) ** 3 * s.life;
        if (weight < best) continue;
        best = weight;
        // A directional current lingers behind the cursor, then eases home.
        targetX = (s.ux * s.speed * 20 + dx / radius * 16) * weight;
        targetY = (s.uy * s.speed * 20 + dy / radius * 16) * weight;
      }
      // Blend into stationary hover as the wake fades, without switching fields.
      targetX += hoverX * (1 - best);
      targetY += hoverY * (1 - best);
      const scale = Math.min(1, this.limit / (Math.hypot(targetX, targetY) || 1));
      out[0] = targetX * scale; out[1] = targetY * scale;
      return out;
    }
    step(offset, velocity, index, targetX, targetY, dt) {
      if (this.timeStep !== dt) {
        this.timeStep = dt;
        this.decay = Math.exp(-this.omega * dt);
      }
      // Exact critically damped solution: stable across refresh rates and long frames.
      for (let axis = 0; axis < 2; axis++) {
        const p = index + axis, target = axis ? targetY : targetX;
        const distance = offset[p] - target;
        const impulse = velocity[p] + this.omega * distance;
        offset[p] = target + (distance + impulse * dt) * this.decay;
        velocity[p] = (velocity[p] - this.omega * impulse * dt) * this.decay;
      }
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { LakeMotion };
  else root.LakeMotion = LakeMotion;
})(typeof window !== 'undefined' ? window : globalThis);

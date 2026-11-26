/* Shared, bounded startup and animation policy. No device-memory API required. */
(() => {
  'use strict';
  const coarse = matchMedia('(pointer: coarse)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const subscribers = new Set();
  const costs = new Map();
  const debug = new URLSearchParams(location.search).get('perf') === '1';
  let mobile = coarse.matches || innerWidth < 768;
  let low = false, overBudgetSince = 0, lastReportAt = 0, resizeTimer;
  let queue = Promise.resolve();
  try { low = sessionStorage.getItem('portfolio-motion-low') === '1'; } catch {}

  function notify() {
    costs.clear(); overBudgetSince = 0; lastReportAt = 0;
    if (debug) document.documentElement.dataset.motionProfile = mobile ? (low ? 'mobile-low' : 'mobile') : 'desktop';
    for (const subscriber of subscribers) {
      try { subscriber(); } catch (error) {
        if (debug) console.warn('Animation profile update failed:', error);
      }
    }
  }
  function afterPaint() {
    return new Promise(resolve => {
      const visible = () => {
        if (document.hidden) return;
        document.removeEventListener('visibilitychange', visible);
        requestAnimationFrame(() => setTimeout(resolve, 0));
      };
      if (document.hidden) document.addEventListener('visibilitychange', visible);
      else visible();
    });
  }
  window.PortfolioMotion = Object.freeze({
    get mobile() { return mobile; },
    get low() { return low; },
    get reduced() { return reduced.matches; },
    debug,
    enqueue(task) {
      const result = queue.then(afterPaint).then(task);
      queue = result.catch(() => {});
      return result;
    },
    subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    report(name, duration) {
      if (!mobile || low || reduced.matches || document.hidden || !Number.isFinite(duration)) return;
      const now = performance.now();
      if (now - lastReportAt > 150) { costs.clear(); overBudgetSince = 0; }
      lastReportAt = now;
      const previous = costs.get(name);
      costs.set(name, { cost: previous ? previous.cost * .8 + duration * .2 : duration, time: now });
      let total = 0;
      for (const [key, entry] of costs) {
        if (now - entry.time > 150) costs.delete(key);
        else total += entry.cost;
      }
      // Leave half of the 30fps frame for scrolling, layout, and browser work.
      if (total <= 16) { overBudgetSince = 0; return; }
      if (!overBudgetSince) overBudgetSince = now;
      if (now - overBudgetSince < 2000) return;
      low = true;
      try { sessionStorage.setItem('portfolio-motion-low', '1'); } catch {}
      // Never rebuild a renderer halfway through its own draw call.
      setTimeout(notify, 0);
    },
  });
  const update = () => {
    const next = coarse.matches || innerWidth < 768;
    if (next !== mobile) { mobile = next; notify(); }
  };
  coarse.addEventListener('change', update);
  reduced.addEventListener('change', notify);
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer); resizeTimer = setTimeout(update, 180);
  }, { passive: true });
  document.addEventListener('visibilitychange', () => { costs.clear(); overBudgetSince = 0; lastReportAt = 0; });
  notify();
})();

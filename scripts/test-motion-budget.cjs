/* Targeted regression checks for bounded startup and mobile quality policy. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../dist/assets/motion-budget.js'), 'utf8');

function events(target = {}) {
  const listeners = new Map();
  target.addEventListener = (name, fn) => {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(fn);
  };
  target.removeEventListener = (name, fn) => listeners.get(name)?.delete(fn);
  target.dispatch = name => { for (const fn of [...(listeners.get(name) || [])]) fn(); };
  return target;
}
function host({ coarse = true, width = 1024, hidden = false, savedLow = false } = {}) {
  let time = 1, serial = 0;
  const frames = new Map(), timers = new Map();
  const storage = new Map(savedLow ? [['portfolio-motion-low', '1']] : []);
  const pointer = events({matches:coarse});
  const reduced = events({matches:false});
  const document = events({hidden,documentElement:{dataset:{}}});
  const global = events({
    document,innerWidth:width,location:{search:''},URLSearchParams,console,
    performance:{now:()=>time},matchMedia:query=>query.includes('coarse') ? pointer : reduced,
    sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
    requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial},
    cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:(fn,ms=0)=>{timers.set(++serial,{fn,due:time+ms});return serial},
    clearTimeout:id=>timers.delete(id),
  });
  global.window=global;
  vm.runInNewContext(source,global,{filename:'motion-budget.js'});
  return {
    global,document,pointer,reduced,storage,frames,
    get api(){return global.PortfolioMotion},
    frame(){time+=17;const queued=[...frames.values()];frames.clear();queued.forEach(fn=>fn(time))},
    advance(ms=0){time+=ms;for(const [id,timer] of [...timers])if(timer.due<=time){timers.delete(id);timer.fn()}},
  };
}
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
async function paint(h){h.frame();h.advance();await settle()}

(async()=>{
  const h=host();
  assert.equal(h.api.mobile,true,'A wide coarse-pointer device stays on the mobile budget');
  const order=[];let release;
  const first=h.api.enqueue(async()=>{order.push('first:start');await new Promise(resolve=>release=resolve);order.push('first:end')});
  const second=h.api.enqueue(()=>order.push('second'));
  await settle();assert.deepEqual(order,[],'No decorative initialization before first paint');
  h.frame();await settle();assert.deepEqual(order,[],'The task also yields beyond the paint callback');
  h.advance();await settle();assert.deepEqual(order,['first:start']);
  await paint(h);assert.deepEqual(order,['first:start'],'An unresolved first initializer blocks the second');
  release();await first;await settle();assert.deepEqual(order,['first:start','first:end']);
  await paint(h);await second;assert.deepEqual(order,['first:start','first:end','second']);

  const asleep=host({hidden:true});let ran=false;
  const resumed=asleep.api.enqueue(()=>{ran=true});await settle();await paint(asleep);
  assert.equal(ran,false,'Hidden pages defer initialization');
  asleep.document.hidden=false;asleep.document.dispatch('visibilitychange');await paint(asleep);await resumed;
  assert.equal(ran,true);

  let notifications=0;h.api.subscribe(()=>notifications++);
  for(let i=0;i<19;i++){h.advance(100);h.api.report('lake',20)}
  assert.equal(h.api.low,false,'Brief slowness does not immediately downgrade quality');
  for(let i=0;i<3;i++){h.advance(100);h.api.report('lake',20)}
  h.advance();assert.equal(h.api.low,true);assert.equal(notifications,1,'A sustained slow interval downgrades once');
  assert.equal(h.storage.get('portfolio-motion-low'),'1');
  for(let i=0;i<30;i++){h.advance(100);h.api.report('lake',30)}
  assert.equal(notifications,1,'The low profile does not trigger repeated rebuilds');
  h.global.innerWidth=1200;h.global.dispatch('resize');h.advance(180);
  assert.equal(h.api.mobile,true);assert.equal(h.api.low,true,'Resizing never upgrades the current visit');
  h.pointer.matches=false;h.pointer.dispatch('change');assert.equal(h.api.mobile,false);assert.equal(h.api.low,true);
  h.pointer.matches=true;h.pointer.dispatch('change');assert.equal(h.api.mobile,true);assert.equal(h.api.low,true);
  assert.equal(host({savedLow:true}).api.low,true,'The low budget survives navigation during the visit');

  const idleGap=host();idleGap.api.report('name',20);idleGap.advance(2200);idleGap.api.report('name',20);
  assert.equal(idleGap.api.low,false,'An idle gap between morphs is not sustained rendering pressure');

  const hiddenCost=host();hiddenCost.document.hidden=true;
  for(let i=0;i<30;i++){hiddenCost.advance(100);hiddenCost.api.report('lake',50)}
  assert.equal(hiddenCost.api.low,false,'Background time is not treated as rendering pressure');
  console.log('Motion budget checks passed: paint boundary, serialized/hidden startup, coarse devices, sustained downgrade, and session persistence.');
})().catch(error=>{console.error(error);process.exitCode=1});

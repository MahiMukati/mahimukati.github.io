/* Behavioral regression checks: deferred lake allocation, capped work, and fail-closed recovery. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../dist/assets/lake-curtain.js'), 'utf8');
function events(target = {}) {
  const listeners = new Map();
  target.addEventListener = (name, fn) => {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(fn);
  };
  target.emit = (name, event={}) => { for(const fn of listeners.get(name)||[])fn(event) };
  return target;
}
function host({ mobile = true, webgl = true, delayedDecode = false } = {}) {
  let resolveDecode;
  const decoding = delayedDecode ? new Promise(resolve => {resolveDecode=resolve}) : Promise.resolve();
  let clock=1, serial=0, webglCalls=0, imageLoads=0, imageDecodes=0, buffers=0, draws=0, mainWrites=0;
  const frames=new Map(),timers=new Map(),jobs=[],intersections=[],resizes=[],subscribers=[];
  const stats={};
  const gl=new Proxy({
    getShaderParameter:()=>true,getProgramParameter:()=>true,getParameter:()=>[1,64],
    createProgram:()=>({}),createShader:()=>({}),createBuffer:()=>({}),createTexture:()=>({}),
    getUniformLocation:()=>({}),getAttribLocation:()=>0,
    bufferData:()=>buffers++,drawArrays:()=>draws++,
  },{get(target,key){if(key in target)return target[key];if(typeof key==='string'&&key===key.toUpperCase())return key;return()=>{}}});
  const context2d=()=>new Proxy({
    measureText:()=>({actualBoundingBoxAscent:10,actualBoundingBoxDescent:3}),
    getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(120)}),
    createLinearGradient:()=>({addColorStop(){}}),
  },{get(target,key){return key in target?target[key]:(()=>{})}});
  const classes=new Set();
  const scene={classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}};
  const box={width:390,height:560,left:0,top:0};
  const canvas=events({dataset:{image:'lake.avif'},style:{},hidden:false,attrs:{},
    closest:()=>scene,getBoundingClientRect:()=>box,
    getContext(type){if(type==='webgl'){webglCalls++;return webgl?gl:null}return context2d()},
    setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},
  });
  let width=0,height=0;
  Object.defineProperties(canvas,{width:{get:()=>width,set:v=>{width=v;mainWrites++}},height:{get:()=>height,set:v=>{height=v;mainWrites++}}});
  const preference=events({matches:false});
  const document=events({hidden:false,documentElement:{dataset:{}},fonts:{load:async()=>[]},
    querySelector:selector=>selector==='#lake-curtain'?canvas:null,
    createElement:()=>({width:0,height:0,getContext:()=>context2d()}),
  });
  // Full renderer narrowed after desktop startup; phone startup is checked separately.
  const budget={mobile,lightweight:false,low:false,debug:false,enqueue(task){jobs.push(task);return Promise.resolve()},subscribe:fn=>subscribers.push(fn),report(){}};
  const global=events({
    document,console,innerWidth:390,devicePixelRatio:3,performance:{now:()=>clock},
    matchMedia:()=>preference,PortfolioMotion:budget,
    requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:(fn,delay=0)=>{timers.set(++serial,{fn,due:clock+delay});return serial},clearTimeout:id=>timers.delete(id),
    Image:class {naturalWidth=640;naturalHeight=639;set src(value){imageLoads++;this.url=value}async decode(){imageDecodes++;await decoding}},
    IntersectionObserver:class{constructor(fn,options){intersections.push({fn,options})}observe(){}},
    ResizeObserver:class{constructor(fn){resizes.push(fn)}observe(){}},
  });
  global.window=global;
  vm.runInNewContext(source,global,{filename:'lake-curtain.js'});
  return {
    canvas,scene,classes,document,budget,box,frames,jobs,releaseDecode:()=>resolveDecode?.(),
    get stats(){return {webglCalls,imageLoads,imageDecodes,buffers,draws,mainWrites}},
    near(value){intersections.find(x=>x.options.rootMargin).fn([{isIntersecting:value}])},
    visible(value){intersections.find(x=>!x.options.rootMargin).fn([{isIntersecting:value}])},
    async initialize(){while(jobs.length)await jobs.shift()()},
    frame(){clock+=34;const list=[...frames.values()];frames.clear();for(const fn of list)fn(clock)},
    resize(){resizes.forEach(fn=>fn());clock+=180;for(const [id,timer] of [...timers])if(timer.due<=clock){timers.delete(id);timer.fn()}},
    low(){budget.low=true;subscribers.forEach(fn=>fn())},
  };
}
(async()=>{
  const h=host();
  assert.equal(h.stats.webglCalls,0,'Opening the page does not create WebGL');
  assert.equal(h.stats.imageLoads,0,'The bottom artwork image is not decoded at startup');
  assert.equal(h.frames.size,0);assert.equal(h.canvas.dataset.state,'deferred');
  h.near(true);h.near(true);assert.equal(h.jobs.length,1,'Repeated near notifications queue one initializer');
  h.near(false);await h.initialize();assert.equal(h.stats.webglCalls,0,'A departed near-viewport job is cancelled before allocation');
  h.near(true);await h.initialize();
  assert.equal(h.stats.webglCalls,1);assert.equal(h.stats.imageLoads,1);assert.equal(h.stats.imageDecodes,1);
  assert.ok(Number(h.canvas.dataset.particles)>1000);assert.ok(Number(h.canvas.dataset.particles)<=8000);
  assert.ok(h.canvas.width<=Math.ceil(390*1.25));assert.ok(h.canvas.height<=Math.ceil(560*1.25));
  assert.equal(h.stats.draws,0,'Near-but-offscreen initialization does not render');assert.equal(h.frames.size,0);
  h.near(true);await h.initialize();assert.equal(h.stats.webglCalls,1,'Re-entering does not recreate the renderer');

  h.visible(true);assert.equal(h.frames.size,1);h.frame();assert.ok(h.stats.draws>0);
  const beforeResize=h.stats;h.resize();assert.equal(h.stats.mainWrites,beforeResize.mainWrites);assert.equal(h.stats.buffers,beforeResize.buffers,'Identical resize does not reallocate backing stores or upload geometry');
  h.visible(false);assert.equal(h.frames.size,0);const offscreen=h.stats.draws;h.frame();assert.equal(h.stats.draws,offscreen);
  h.visible(true);h.document.hidden=true;h.document.emit('visibilitychange');assert.equal(h.frames.size,0);
  const background=h.stats.draws;h.frame();assert.equal(h.stats.draws,background);
  h.document.hidden=false;h.document.emit('visibilitychange');assert.equal(h.frames.size,1);
  h.low();assert.ok(Number(h.canvas.dataset.particles)<=4000);assert.ok(Number(h.canvas.dataset.particles)>500);

  let prevented=false;h.canvas.emit('webglcontextlost',{preventDefault(){prevented=true}});
  assert.equal(prevented,true);assert.equal(h.canvas.dataset.state,'fallback');assert.equal(h.canvas.hidden,true);
  assert.equal(h.classes.has('is-ready'),false);assert.equal(h.frames.size,0);assert.equal(h.canvas.width,1);assert.equal(h.canvas.height,1);
  const lost=h.stats;h.canvas.emit('webglcontextrestored');h.near(false);h.near(true);h.visible(true);h.resize();await h.initialize();h.frame();
  assert.equal(h.stats.webglCalls,lost.webglCalls);assert.equal(h.stats.buffers,lost.buffers);assert.equal(h.stats.draws,lost.draws,'Mobile context loss stays on the fallback without rebuild loops');

  const interrupted=host({delayedDecode:true});interrupted.near(true);const pending=interrupted.initialize();
  assert.equal(interrupted.stats.webglCalls,1);interrupted.canvas.emit('webglcontextlost',{preventDefault(){}});
  interrupted.canvas.emit('webglcontextrestored');interrupted.releaseDecode();await pending;
  assert.equal(interrupted.canvas.dataset.state,'fallback');assert.equal(interrupted.classes.has('is-ready'),false);
  assert.equal(interrupted.stats.buffers,0,'A lost context during decoding cannot revive the heavy renderer');

  const unavailable=host({webgl:false});unavailable.near(true);await unavailable.initialize();
  assert.equal(unavailable.canvas.dataset.state,'fallback');assert.equal(unavailable.stats.imageLoads,0);
  unavailable.near(false);unavailable.near(true);await unavailable.initialize();assert.equal(unavailable.stats.webglCalls,1);
  console.log('Lake checks passed: deferred startup, single initialization, mobile/low caps, resize reuse, visibility suspension, and permanent mobile fallback.');
})().catch(error=>{console.error(error);process.exitCode=1});

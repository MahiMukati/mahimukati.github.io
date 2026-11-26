// Rebuild the static mobile artwork from the approved desktop renderer.
// Local tooling only; none of these dependencies are loaded by the website.
// npm install --prefix .work/name-shape-tools --no-audit --no-fund @napi-rs/canvas@1.2.1
// python3 -m venv .work/image-tools && .work/image-tools/bin/pip install Pillow
// On non-macOS hosts, point MAHI_MONOSPACE_FONT to the matching Menlo font file.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
process.chdir(root);
fs.mkdirSync('dist/assets/mobile',{recursive:true});
fs.mkdirSync('.work/mobile-perf',{recursive:true});
const {createCanvas,loadImage,GlobalFonts}=require(path.join(root,'.work/name-shape-tools/node_modules/@napi-rs/canvas'));
GlobalFonts.registerFromPath(path.resolve('dist/assets/fonts/noto-nastaliq-urdu.ttf'),'Noto Nastaliq Urdu');
(async()=>{
 let draws=0, now=0, nextID=1, hidden=false, visible=true, reduced=false;
 const rafs=new Map(), jobs=[], surfaces=[], events=new Map(), subscribers=[], ios=[];
 function surface(w=300,h=150){
  const native=createCanvas(w,h),value={native,get width(){return native.width},set width(n){native.width=n},get height(){return native.height},set height(n){native.height=n}};
  const ctx=native.getContext('2d');
  const proxy=new Proxy(ctx,{get(target,key){if(key==='drawImage')return(image,...args)=>{draws++;target.drawImage(image.native||image,...args)};const field=target[key];return typeof field==='function'?field.bind(target):field},set(target,key,value){target[key]=value;return true}});
  value.getContext=()=>proxy;surfaces.push(value);return value;
 }
 const source=await loadImage(path.resolve('dist/assets/Gallery/portrait.webp'));
 const img={native:source,naturalWidth:source.width/Number(process.env.TASK_PORTRAIT_DENSITY||1),naturalHeight:source.height/Number(process.env.TASK_PORTRAIT_DENSITY||1),decode:async()=>{}};
 class Image{set src(value){this.path=path.resolve('dist',value.replace(/^\/?assets\//,'assets/'))}get naturalWidth(){return this.native.width}get naturalHeight(){return this.native.height}async decode(){this.native=await loadImage(this.path)}}
 const canvas=surface(),classes=new Set();
 const figure={dataset:{cutout:'assets/Gallery/portrait-alpha-mask.webp'},querySelector(s){return s==='img'?img:canvas},getBoundingClientRect(){return{width:512,top:120,bottom:745}},classList:{add:n=>classes.add(n),remove:n=>classes.delete(n)}};
 const document={get hidden(){return hidden},fonts:{load:async()=>{}},querySelectorAll(){return[figure]},createElement(){return surface()},addEventListener(n,fn){events.set(n,fn)}};
 const runtime={lightweight:false,mobile:true,low:false,debug:true,get reduced(){return reduced},enqueue(fn){const promise=fn();jobs.push(promise);return promise},report(){},subscribe(fn){subscribers.push(fn)}};
 const sandbox={document,window:{PortfolioMotion:runtime,addEventListener(n,fn){events.set(n,fn)}},innerWidth:390,innerHeight:844,devicePixelRatio:3,matchMedia:()=>({matches:false,addEventListener(){}}),localStorage:{getItem(){return null}},Image,performance:{now:()=>now},setTimeout,clearTimeout,requestAnimationFrame(fn){const id=nextID++;rafs.set(id,fn);return id},cancelAnimationFrame:id=>rafs.delete(id),IntersectionObserver:class{constructor(fn){ios.push(fn)}observe(){}},ResizeObserver:class{observe(){}},console};
 sandbox.window.IntersectionObserver=sandbox.IntersectionObserver; sandbox.window.ResizeObserver=sandbox.ResizeObserver;
 vm.runInNewContext(fs.readFileSync('dist/assets/portrait-letters.js','utf8'),sandbox);
 await Promise.all(jobs);
 assert(classes.has('is-ready'));assert.equal(canvas.width,640);assert.equal(canvas.height,783);
 fs.writeFileSync('.work/mobile-perf/portrait-raw.png',await canvas.native.encode('png'));
 // Limit imperceptible opacity precision to compress the dense glyph fringe.
 // Alpha endpoints remain exactly transparent/opaque; maximum deviation is8/255.
 const python=process.env.MAHI_IMAGE_PYTHON||path.join(root,'.work/image-tools/bin/python');
 execFileSync(python,['-c',`from PIL import Image
import sys
image=Image.open(sys.argv[1])
image.putalpha(image.getchannel('A').point(lambda value:min(255,round(value/16)*16)))
image.save(sys.argv[2],'WEBP',quality=80,method=6)`,'.work/mobile-perf/portrait-raw.png','.work/mobile-perf/portrait-rendered.webp']);
 fs.copyFileSync('.work/mobile-perf/portrait-rendered.webp','dist/assets/mobile/portrait.webp');
 const data=JSON.parse(fs.readFileSync('dist/assets/jali-thuluth/name-shapes.json'));
 GlobalFonts.registerFromPath(process.env.MAHI_MONOSPACE_FONT||'/System/Library/Fonts/Menlo.ttc','Menlo');
 const glyphs=[...'+:*#=.'];
 for (const [theme,ink,accent] of [['light','#183b40','#286a74'],['dark','#fffef9','#91c7ca']]) {
  const mark=createCanvas(208,120),ctx=mark.getContext('2d');
  ctx.setTransform(208/512,0,0,120/300,0,0);
  ctx.translate(512/2,300/2);ctx.scale(1.12,1.12);ctx.translate(-512/2,-300/2);
  ctx.font='400 16px Menlo, monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  const colors=[ink,ink,accent,ink];
  data.shapes[1].forEach(([x,y,alpha,dot,width],index)=>{
   ctx.fillStyle=dot?ink:colors[index%colors.length];ctx.globalAlpha=alpha;
   if(dot){
    ctx.font='400 11px Menlo, monospace';
    ctx.fillText('+',x,y-5);ctx.fillText('#',x-3.8,y);ctx.fillText('#',x+3.8,y);ctx.fillText('+',x,y+5);
    ctx.font='400 16px Menlo, monospace';
   } else {
    ctx.save();ctx.translate(x,y);ctx.scale(width,1);ctx.fillText(glyphs[index%glyphs.length],0,0);ctx.restore();
   }
  });
  ctx.globalAlpha=1;
  fs.writeFileSync('dist/assets/mobile/name-'+theme+'.webp',await mark.encode('webp',100));
 }
 for(const filename of ['portrait.webp','name-light.webp','name-dark.webp']){
  const native=await loadImage('dist/assets/mobile/'+filename);
  console.log(filename+' '+native.width+'×'+native.height+' '+fs.statSync('dist/assets/mobile/'+filename).size+' bytes');
 }
 events.get('pagehide')({persisted:false});
})().catch(error=>{console.error(error);process.exitCode=1});

/* Original photo pixels for the person; Urdu glyphs for the city behind them.
   The earlier edge-only treatment is retained for saved browser preferences. */
(() => {
  const alphabet = Array.from('ابتٹثجچحخدڈرڑزژسشصضطظعغفقکگلمنںوہھیے');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const W = 360, H = 440, insetX = 40, insetY = 40, photoW = 280, photoH = 360;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const random = (n, seed) => { const v = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return v - Math.floor(v); };
  const edge = (x, y) => {
    const distance = Math.min(x - insetX, insetX + photoW - x, y - insetY, insetY + photoH - y);
    return distance + Math.sin(x * .073 + y * .039) * 5 + Math.sin(y * .13 - x * .047) * 3;
  };

  document.querySelectorAll('[data-letter-portrait]').forEach(async figure => {
    const img = figure.querySelector('img');
    const canvas = figure.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      await Promise.all([img.decode(), document.fonts.load('13px "Noto Nastaliq Urdu"')]);
      // A srcset image reports density-corrected dimensions. Decode its chosen
      // source separately so the canvas crop uses the actual source pixels.
      const source = new Image();
      source.src = img.currentSrc || img.src;
      await source.decode();
      const scale = Math.min(devicePixelRatio || 1, 2);
      canvas.width = W * scale;
      canvas.height = H * scale;
      ctx.scale(scale, scale);

      const photo = document.createElement('canvas');
      photo.width = W * scale;
      photo.height = H * scale;
      const pc = photo.getContext('2d', {willReadFrequently:true});
      pc.scale(scale, scale);
      // Match object-fit: cover; never stretch the face.
      const ratio = Math.max(photoW / source.naturalWidth, photoH / source.naturalHeight);
      const sw = photoW / ratio, sh = photoH / ratio;
      pc.drawImage(source, (source.naturalWidth-sw)/2, (source.naturalHeight-sh)/2, sw, sh, insetX, insetY, photoW, photoH);
      const pixels = pc.getImageData(0, 0, photo.width, photo.height);
      const subject = document.createElement('canvas');
      subject.width=canvas.width;subject.height=canvas.height;
      const sc=subject.getContext('2d');
      sc.drawImage(photo,0,0);
      const mask=document.createElement('canvas');
      mask.width=canvas.width;mask.height=canvas.height;
      const mc=mask.getContext('2d',{willReadFrequently:true});
      let separated=false;
      try {
        const cutout=new Image();
        cutout.src=figure.dataset.cutout;
        await cutout.decode();
        // Only the generated alpha is used. Face, hair and clothing colors are
        // always the exact pixels of the original photograph, not a generated face.
        mc.drawImage(cutout,
          (source.naturalWidth-sw)/2/source.naturalWidth*cutout.naturalWidth,
          (source.naturalHeight-sh)/2/source.naturalHeight*cutout.naturalHeight,
          sw/source.naturalWidth*cutout.naturalWidth,
          sh/source.naturalHeight*cutout.naturalHeight,
          insetX*scale,insetY*scale,photoW*scale,photoH*scale);
        sc.globalCompositeOperation='destination-in';
        sc.drawImage(mask,0,0);
        sc.globalCompositeOperation='source-over';
        // Let the cropped torso meet the existing soft outer fringe.
        const subjectPixels=sc.getImageData(0,0,subject.width,subject.height);
        for(let y=0;y<subject.height;y++) for(let x=0;x<subject.width;x++) {
          subjectPixels.data[(y*subject.width+x)*4+3] *= smooth(0,18,edge(x/scale,y/scale));
        }
        sc.putImageData(subjectPixels,0,0);
        separated=true;
      } catch(error) {
        console.warn('portrait cutout unavailable; retaining earlier version',error);
      }
      const colorAt = (x, y) => {
        const sx = Math.floor(clamp(x, insetX+1, insetX+photoW-2) * scale);
        const sy = Math.floor(clamp(y, insetY+1, insetY+photoH-2) * scale);
        const i = (sy * photo.width + sx) * 4;
        return `rgb(${pixels.data[i]},${pixels.data[i+1]},${pixels.data[i+2]})`;
      };
      const glyphLayer = document.createElement('canvas');
      glyphLayer.width = canvas.width;
      glyphLayer.height = canvas.height;
      const gc = glyphLayer.getContext('2d');
      gc.scale(scale,scale);
      gc.font = '13px "Noto Nastaliq Urdu"';
      gc.textAlign = 'center';
      gc.textBaseline = 'middle';
      const background=document.createElement('canvas');
      background.width=canvas.width;background.height=canvas.height;
      const bc=background.getContext('2d');
      bc.scale(scale,scale);
      bc.font=gc.font;bc.textAlign=gc.textAlign;bc.textBaseline=gc.textBaseline;
      // Dense, still letters carry the structure of the photo into the loose fringe.
      let index = 0;
      for (let y=22; y<H-22; y+=6) for (let x=22; x<W-22; x+=5) {
        index++;
        const px=x+(random(index,1)-.5)*3, py=y+(random(index,2)-.5)*3;
        const d=edge(px,py);
        // In the new version, every background pixel is replaced by a letter.
        const backgroundOpacity=smooth(-17,12,d);
        if(backgroundOpacity>.025 && random(index,3)<smooth(-19,8,d)) {
          bc.globalAlpha=backgroundOpacity*(.76+random(index,4)*.24);
          bc.fillStyle=colorAt(px,py);
          bc.fillText(alphabet[index%alphabet.length],px,py);
        }
        const opacity = smooth(-17,10,d) * (1-smooth(17,50,d));
        if (opacity<.025 || random(index,3)>smooth(-19,8,d)) continue;
        gc.globalAlpha=opacity*(.65+random(index,4)*.35);
        gc.fillStyle=colorAt(px,py);
        gc.fillText(alphabet[index%alphabet.length],px,py);
      }
      // Mask alpha only; the original photo and its colors remain untouched.
      for(let y=0;y<photo.height;y++) for(let x=0;x<photo.width;x++) {
        const i=(y*photo.width+x)*4+3;
        pixels.data[i] *= smooth(9,49,edge(x/scale,y/scale));
      }
      pc.putImageData(pixels,0,0);

      const particles=[];
      const atlas=document.createElement('canvas');
      const tile=28, count=150;
      atlas.width=tile*count*scale;
      atlas.height=tile*scale;
      const ac=atlas.getContext('2d');
      ac.scale(scale,scale);
      ac.font='13px "Noto Nastaliq Urdu"';
      ac.textAlign='center'; ac.textBaseline='middle';
      for(let i=0;i<count;i++) {
        const side=i%4, along=random(i,5);
        let x,y;
        if(side<2){ x=side===0?insetX+8:insetX+photoW-8; y=insetY+along*photoH; }
        else { x=insetX+along*photoW; y=side===2?insetY+9:insetY+photoH-9; }
        ac.fillStyle=colorAt(x,y);
        ac.fillText(alphabet[i%alphabet.length],i*tile+tile/2,tile/2);
        particles.push({x,y,dx:side===0?-1:side===1?1:(along-.5)*1.4,dy:side===3?.3:-1,
          phase:random(i,6),duration:9+random(i,7)*9,reach:14+random(i,8)*20});
      }
      let visible=true, frame=0, last=0, time=0;
      let letterBackground=separated;
      try {if(localStorage.getItem('mahi-portrait-version')==='earlier') letterBackground=false;} catch {}
      const draw = () => {
        ctx.clearRect(0,0,W,H);
        ctx.globalAlpha=1;
        if(letterBackground){
          ctx.drawImage(background,0,0,W,H);
        } else {
          ctx.drawImage(photo,0,0,W,H);
          ctx.drawImage(glyphLayer,0,0,W,H);
        }
        for(let i=0;i<particles.length;i++) {
          const p=particles[i];
          const t=(p.phase+time/p.duration)%1;
          ctx.globalAlpha=Math.sin(Math.PI*t)*.62;
          const x=p.x+p.dx*p.reach*t+Math.sin(t*5+p.phase*6)*2;
          const y=p.y+p.dy*p.reach*t-9*t;
          ctx.drawImage(atlas,i*tile*scale,0,tile*scale,tile*scale,x-tile/2,y-tile/2,tile,tile);
        }
        ctx.globalAlpha=1;
        // The person is the top layer, so drifting letters never cross the face.
        if(letterBackground) ctx.drawImage(subject,0,0,W,H);
      };
      figure.dataset.portraitVersion=letterBackground?'letter-background':'earlier';
      const tick = now => {
        frame=0;
        if(!visible || document.hidden || reduced.matches) return;
        if(now-last>=32){time+=Math.min((now-last)/1000,.05);last=now;draw();}
        frame=requestAnimationFrame(tick);
      };
      const resume = () => {
        cancelAnimationFrame(frame);frame=0;last=performance.now();
        draw();
        if(visible && !document.hidden && !reduced.matches) frame=requestAnimationFrame(tick);
      };
      draw();
      figure.classList.add('is-ready');
      new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;resume();}).observe(figure);
      document.addEventListener('visibilitychange',resume);
      reduced.addEventListener('change',resume);
    } catch(error) {
      // The accessible photo remains visible if decoding or canvas setup is unavailable.
      console.warn('portrait letter effect unavailable',error);
    }
  });
})();

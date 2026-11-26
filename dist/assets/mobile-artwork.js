/* Prepared artwork for phones. No canvas, font rasterization, or frame loop. */
(() => {
  'use strict';
  if (!window.PortfolioMotion?.lightweight) return;
  const base = new URL('mobile/', document.currentScript.src);
  const mark = document.querySelector('.mobile-name');
  const updateMark = () => {
    if (!mark) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    mark.src = new URL(dark ? 'name-dark.webp' : 'name-light.webp', base).href;
    mark.hidden = false;
  };
  updateMark();
  window.addEventListener('portfolio:themechange', updateMark);

  // Freeze the responsive source for this visit, including phone rotation.
  const portrait = document.querySelector('[data-letter-portrait] img');
  if (portrait) {
    portrait.src = new URL('portrait.webp', base).href;
    portrait.removeAttribute('srcset'); portrait.removeAttribute('sizes');
    portrait.closest('picture')?.querySelectorAll('source').forEach(source => source.remove());
    portrait.width = 640; portrait.height = 783;
  }
  const lake = document.querySelector('.lake-fallback');
  if (lake) {
    const artwork = innerWidth >= 600
      ? lake.dataset.mobileWide || 'lake-urdu-wide.webp'
      : lake.dataset.mobileArt || 'lake-urdu.webp';
    lake.src = new URL(artwork, base).href;
    lake.closest('picture')?.querySelectorAll('source').forEach(source => source.remove());
  }
  document.querySelectorAll('canvas').forEach(canvas => {
    canvas.width = canvas.height = 1;
    canvas.hidden = true;
  });
  const interactionHelp = document.querySelector('#curtain-help');
  if (interactionHelp) interactionHelp.hidden = true;

  const sections = [...document.querySelectorAll('.home-greeting, .home-current, .lake-scene')];
  const counts = sections.map((section, index) => section.classList.contains('lake-scene') ? 10 : index + 4);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const twinkleCount = Math.round(total * .05);
  const twinkleSlots = new Set(Array.from({ length: twinkleCount }, (_, i) => Math.floor((i + .5) * total / twinkleCount)));
  let letterIndex = 0;
  const fields = sections.map((section, index) => {
    const field = document.createElement('div');
    field.className = 'mobile-letter-field';
    field.setAttribute('aria-hidden', 'true');
    const count = counts[index];
    for (let n = 0; n < count; n++) {
      const letter = document.createElement('i');
      const tile = (n * 5 + index * 3) % 12;
      letter.className = 'mobile-letter';
      letter.style.backgroundImage = `url("${new URL(section.dataset.letterSprites || 'urdu-sprites.webp', base).href}")`;
      letter.style.backgroundPosition = `${-(tile % 4) * 24}px ${-Math.floor(tile / 4) * 24}px`;
      letter.style.left = `${4 + ((n * 31 + index * 17) % 89)}%`;
      letter.style.setProperty('--delay', `${-(n * 7 + index * 3)}s`);
      letter.style.setProperty('--duration', `${24 + n % 4 * 4}s`);
      if (twinkleSlots.has(letterIndex++)) {
        // A tiny inner sprite twinkles independently of the outer rise/fade.
        const glyph = document.createElement('span');
        glyph.className = 'mobile-letter-twinkle';
        glyph.style.backgroundImage = letter.style.backgroundImage;
        glyph.style.backgroundPosition = letter.style.backgroundPosition;
        glyph.style.setProperty('--twinkle-delay', `${-(index + n * .17)}s`);
        letter.style.backgroundImage = 'none';
        letter.append(glyph);
      }
      field.append(letter);
    }
    section.prepend(field);
    return field;
  });
  const visible = new Set();
  const update = () => fields.forEach(field => {
    field.classList.toggle('is-moving', !document.hidden && visible.has(field));
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      update();
    });
    fields.forEach(field => observer.observe(field));
  }
  document.addEventListener('visibilitychange', update);
  window.addEventListener('pagehide', () => fields.forEach(field => field.classList.remove('is-moving')));
  window.addEventListener('pageshow', update);
})();

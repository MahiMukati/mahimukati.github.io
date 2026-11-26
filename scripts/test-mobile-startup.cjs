/* A mobile visit must exit before touching native graphics or loading artwork. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const files = ['name-morph.js', 'portrait-letters.js', 'scroll-letters.js', 'lake-curtain.js'];
for (const file of files) {
  const source = fs.readFileSync(path.join(__dirname, '../dist/assets', file), 'utf8');
  for (const profile of ['phone', 'rotated-phone', 'no-runtime']) {
    let nativeWork = 0;
    const forbidden = () => { nativeWork++; throw new Error(`Unexpected startup graphics in ${file}`); };
    const window = profile === 'no-runtime' ? {} : { PortfolioMotion: { lightweight: true, mobile: profile === 'phone' } };
    vm.runInNewContext(source, {
      window, innerWidth: profile === 'phone' ? 390 : 844,
      matchMedia: query => ({ matches: query === '(pointer: coarse)' }),
      document: new Proxy({}, { get: forbidden }), Image: forbidden,
      fetch: forbidden, requestAnimationFrame: forbidden,
    }, { filename: file });
    assert.equal(nativeWork, 0, `${file} must do no graphics work for ${profile}`);
  }
}
for (const file of ['index.html', 'projects/index.html', 'writing/index.html']) {
  const html = fs.readFileSync(path.join(__dirname, '../dist', file), 'utf8');
  assert.match(html, /motion-budget\.js\?v=2"><\/script>/, 'Mobile policy runs before body/fonts');
  assert.match(html, /class="mobile-name"/, 'Mobile mark must not need a canvas');
  assert.doesNotMatch(html, /rel="preload"[^>]*noto-nastaliq/, 'Mobile must not preload the Urdu font');
}
console.log('Mobile startup passed: all four effects skip native graphics, including rotation; policy precedes body/fonts.');

// Keep navigation and content independent of JavaScript.
// Respect reduced motion for browser-level anchor scrolling.
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.style.scrollBehavior = 'auto';
}

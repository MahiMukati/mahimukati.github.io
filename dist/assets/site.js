// Content and navigation remain usable without JavaScript.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const portrait = document.querySelector('.portrait');
const portraitToggle = document.querySelector('.portrait-toggle');
if (portrait && portraitToggle) {
  portraitToggle.hidden = false;
  portraitToggle.addEventListener('click', () => {
    const inColor = portrait.classList.toggle('is-original');
    portraitToggle.setAttribute('aria-pressed', String(inColor));
    portraitToggle.textContent = inColor ? 'view in duotone' : 'view in color';
  });
}
const workLinks = document.querySelectorAll('[data-preview]');
const previewFrames = document.querySelectorAll('[data-image]');
function showProject(name) {
  workLinks.forEach(link => link.classList.toggle('is-active', link.dataset.preview === name));
  previewFrames.forEach(frame => frame.classList.toggle('is-active', frame.dataset.image === name));
}
workLinks.forEach(link => {
  link.addEventListener('pointerenter', () => showProject(link.dataset.preview));
  link.addEventListener('focus', () => showProject(link.dataset.preview));
});
// Animate visible content only; nothing stays hidden if a script fails.
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.animate([
        { opacity: 0.5, transform: 'translateY(18px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration: 650, easing: 'cubic-bezier(.2,.65,.3,1)' });
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.work-heading, .work-link, .work-preview, .project-card, .project-figure, .site-footer').forEach(element => observer.observe(element));
  reducedMotion.addEventListener('change', event => {
    if (event.matches) {
      observer.disconnect();
      document.getAnimations().forEach(animation => animation.finish());
    }
  });
}

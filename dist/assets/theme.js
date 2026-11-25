(() => {
  'use strict';

  const storageKey = 'portfolio-theme';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const validTheme = value => value === 'light' || value === 'dark' ? value : null;
  let choice = null;
  let buttons = [];

  try { choice = validTheme(window.localStorage.getItem(storageKey)); } catch (_) {}

  function updateButtons(theme) {
    const action = theme === 'dark' ? 'switch to light mode' : 'switch to dark mode';
    for (const button of buttons) {
      button.setAttribute('aria-label', action);
      button.title = action;
      button.hidden = false;
    }
  }

  function applyTheme(theme) {
    const changed = document.documentElement.dataset.theme !== theme;
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#123C40' : '#E6E1D7';
    updateButtons(theme);
    if (changed) window.dispatchEvent(new CustomEvent('portfolio:themechange', { detail: { theme } }));
  }

  function preferredTheme() {
    return choice || (systemTheme.matches ? 'dark' : 'light');
  }

  // This script runs before styles so the first paint uses the saved appearance.
  applyTheme(preferredTheme());

  function initializeButtons() {
    buttons = Array.from(document.querySelectorAll('[data-theme-toggle]'));
    for (const button of buttons) {
      button.addEventListener('click', () => {
        choice = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        try { window.localStorage.setItem(storageKey, choice); } catch (_) {}
        applyTheme(choice);
      });
    }
    applyTheme(preferredTheme());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeButtons, { once: true });
  else initializeButtons();

  const systemChanged = () => { if (!choice) applyTheme(preferredTheme()); };
  if (systemTheme.addEventListener) systemTheme.addEventListener('change', systemChanged);
  else systemTheme.addListener(systemChanged);

  window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    // Ignore an unrelated sessionStorage event with the same key.
    try { if (event.storageArea && event.storageArea !== window.localStorage) return; } catch (_) {}
    choice = validTheme(event.newValue);
    applyTheme(preferredTheme());
  });
})();

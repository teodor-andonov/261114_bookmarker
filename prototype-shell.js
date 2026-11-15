// Shared Testlab navigation and theme preference; injected during site assembly.
// Prototype source files remain independent and can run without this script.
(() => {
  const KEY = 'testlab-theme';
  const root = document.documentElement;
  const tray = document.createElement('nav');
  tray.className = 'testlab-floating-controls';
  tray.setAttribute('aria-label', 'Testlab navigation');
  tray.innerHTML = [
    '<button type="button" class="testlab-floating-button testlab-theme-button" aria-label="Toggle light or dark mode" title="Toggle theme">',
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="18" height="18">',
    '<path d="M20 12.7A8.5 8.5 0 0 1 11.3 4 8.5 8.5 0 1 0 20 12.7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    '</svg></button>',
    '<a class="testlab-floating-button testlab-home-button" href="../" aria-label="Back to Testlab home" title="Back to Testlab">',
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="18" height="18">',
    '<path d="m3 10 9-7 9 7v10h-6v-7H9v7H3V10Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    '</svg></a>'
  ].join('');
  document.body.append(tray);
  // Resolve home from the shared script URL, not the current prototype route.
  const home = tray.querySelector('.testlab-home-button');
  if (document.currentScript?.src) home.href = new URL('./', document.currentScript.src).href;
  const toggle = tray.querySelector('.testlab-theme-button');
  const moonIcon = toggle.innerHTML;
  const sunIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function storedTheme() {
    try {
      const value = localStorage.getItem(KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch { return null; }
  }
  function apply(theme, persist = false) {
    const next = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = next;
    if (persist) {
      try { localStorage.setItem(KEY, next); } catch {}
    }
    toggle.innerHTML = next === 'dark' ? sunIcon : moonIcon;
    toggle.title = next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    toggle.setAttribute('aria-label', toggle.title);
    toggle.setAttribute('aria-pressed', String(next === 'dark'));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(root).backgroundColor;
    window.dispatchEvent(new CustomEvent('testlab:themechange', { detail: { theme: next } }));
  }

  apply(storedTheme() || (media.matches ? 'dark' : 'light'));
  toggle.addEventListener('click', () => apply(root.dataset.theme === 'dark' ? 'light' : 'dark', true));
  media.addEventListener?.('change', e => {
    if (!storedTheme()) apply(e.matches ? 'dark' : 'light');
  });
  window.addEventListener('storage', e => {
    if (e.key === KEY) apply(storedTheme() || (media.matches ? 'dark' : 'light'));
  });
})();

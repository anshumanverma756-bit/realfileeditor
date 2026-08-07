// Runs inline, before first paint, to avoid a light/dark flash.
// Kept as a standalone string so it can be inlined in <head>.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('rfe-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored ? stored === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', isDark);
  } catch (e) {}
})();
`;

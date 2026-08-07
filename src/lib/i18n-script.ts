import { TRANSLATIONS } from "./i18n";

// Inlined into <head> so translated text is applied before paint on
// repeat visits (no flash of English), same pattern as theme-init.ts.
export function buildI18nScript(): string {
  return `
(function () {
  try {
    var dict = ${JSON.stringify(TRANSLATIONS)};
    var supported = Object.keys(dict);
    var stored = localStorage.getItem('rfe-lang');
    var browserLang = (navigator.language || 'en').slice(0, 2);
    var lang = stored || (supported.indexOf(browserLang) !== -1 ? browserLang : 'en');

    window.__rfeApplyLang = function (code) {
      var table = dict[code] || dict.en;
      document.querySelectorAll('[data-i18n]').forEach(function (el) {
        var key = el.getAttribute('data-i18n');
        if (table[key]) el.textContent = table[key];
      });
      document.documentElement.setAttribute('lang', code);
      var sel = document.getElementById('lang-select');
      if (sel) sel.value = code;
    };

    document.addEventListener('DOMContentLoaded', function () {
      window.__rfeApplyLang(lang);
    });
  } catch (e) {}
})();
`;
}

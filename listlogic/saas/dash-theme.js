/* ListLogic dashboard theme toggle (owner + agent consoles)
 * - Injects a 🌓 button into the page's top nav
 * - Persists choice in localStorage ('ll-dash-theme')
 * - Toggles body.light; pages carry their own light-theme CSS
 */
(function () {
  var KEY = 'll-dash-theme';

  function apply(theme) {
    document.body.classList.toggle('light', theme === 'light');
    var btn = document.getElementById('llThemeToggle');
    if (btn) {
      btn.textContent = theme === 'light' ? '☾' : '☀';
      btn.title = theme === 'light' ? 'Switch to dark' : 'Switch to light';
      btn.setAttribute('aria-label', btn.title);
    }
  }

  function current() {
    return localStorage.getItem(KEY) ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  }

  function init() {
    // Don't run twice
    if (document.getElementById('llThemeToggle')) return;

    // Find insertion point: owner console topbar or agent ll-nav links
    var host =
      document.querySelector('.topbar .top-links') ||   // admin redesign
      document.querySelector('.ll-nav .ll-nav-links');  // agent console (+ legacy)
    if (!host) return;

    var btn = document.createElement('button');
    btn.id = 'llThemeToggle';
    btn.type = 'button';
    btn.className = 'll-theme-toggle';
    btn.addEventListener('click', function () {
      var next = document.body.classList.contains('light') ? 'dark' : 'light';
      try { localStorage.setItem(KEY, next); } catch (e) {}
      apply(next);
    });
    host.insertBefore(btn, host.firstChild);

    apply(current());

    // Sync across tabs
    window.addEventListener('storage', function (e) {
      if (e.key === KEY) apply(e.newValue === 'light' ? 'light' : 'dark');
    });

    // Expose for pages that need to react to switches (e.g. charts)
    window.llDashTheme = {
      get: current,
      isLight: function () { return document.body.classList.contains('light'); }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

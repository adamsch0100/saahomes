/* ListLogic dashboard theme toggle (owner + agent consoles)
 *
 * One shared preference ('light' | 'dark') stored in localStorage
 * under 'll-dash-theme' — switching on one page switches both.
 *
 * Each page declares its own default via <body data-theme-default="dark|light">.
 * The toggle adds/removes an override class on <body>:
 *   - if page default is dark  → override class is 'light'
 *   - if page default is light → override class is 'dark'
 * Pages ship CSS for their override class (dash-light-admin.css /
 * dash-light-agent.css).
 */
(function () {
  var KEY = 'll-dash-theme';

  function pageDefault() {
    var d = document.body.getAttribute('data-theme-default');
    return d === 'light' ? 'light' : 'dark';
  }

  function overrideClass() {
    return pageDefault() === 'dark' ? 'light' : 'dark';
  }

  function effectiveTheme(stored) {
    return stored || pageDefault();
  }

  function apply(stored) {
    var theme = effectiveTheme(stored);
    var cls = overrideClass();
    var wantOverride = (theme !== pageDefault());
    document.body.classList.toggle(cls, wantOverride);
    // Clean the opposite class in case of stray state
    var other = cls === 'light' ? 'dark' : 'light';
    document.body.classList.remove(other);

    var btn = document.getElementById('llThemeToggle');
    if (btn) {
      btn.textContent = theme === 'light' ? '☾' : '☀';
      btn.title = theme === 'light' ? 'Switch to light mode' : 'Switch to dark mode';
      btn.setAttribute('aria-label', btn.title);
    }
  }

  function getStored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function setStored(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }

  function init() {
    if (!document.body || document.getElementById('llThemeToggle')) return;

    var host =
      document.querySelector('.topbar .top-links') ||
      document.querySelector('.ll-nav .ll-nav-links');
    if (!host) return;

    var btn = document.createElement('button');
    btn.id = 'llThemeToggle';
    btn.type = 'button';
    btn.className = 'll-theme-toggle';
    btn.addEventListener('click', function () {
      var next = getStored() === 'light' ? 'dark'
               : getStored() === 'dark' ? 'light'
               : (pageDefault() === 'dark' ? 'light' : 'dark');
      setStored(next);
      apply(next);
    });
    host.insertBefore(btn, host.firstChild);
    apply(getStored());

    window.addEventListener('storage', function (e) {
      if (e.key === KEY) apply(e.newValue);
    });

    window.llDashTheme = {
      get: function () { return effectiveTheme(getStored()); },
      isLight: function () { return effectiveTheme(getStored()) === 'light'; }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

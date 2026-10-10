/** Small helpers shared by the sign-in pages: remember the last email, show/hide passwords. */
(function () {
  var LAST_EMAIL_KEY = 'll_last_email';
  window.llRememberEmail = function (email) {
    try { localStorage.setItem(LAST_EMAIL_KEY, (email || '').trim().toLowerCase()); } catch (e) {}
  };
  window.llLastEmail = function () {
    try { return localStorage.getItem(LAST_EMAIL_KEY) || ''; } catch (e) { return ''; }
  };
  function bindToggles() {
    document.querySelectorAll('.pw-show[data-for]').forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        var input = document.getElementById(btn.getAttribute('data-for'));
        if (!input) return;
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? 'Hide' : 'Show';
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindToggles);
  else bindToggles();
})();

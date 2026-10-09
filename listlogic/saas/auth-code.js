/**
 * Shared email sign-in for login + signup: send the magic link, then let the agent
 * type the 6-digit code from the email right here instead of hunting for the link.
 *
 * Usage: llEmailAuth({ form, emailInput, submitBtn, statusEl, devEl, buildPayload, onSent })
 */
(function () {
  var LAST_EMAIL_KEY = 'll_last_email';

  function store(key, val) {
    try {
      if (val) localStorage.setItem(key, val);
      else localStorage.removeItem(key);
    } catch (e) {}
  }
  function read(key) {
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }

  window.llRememberEmail = function (email) { store(LAST_EMAIL_KEY, (email || '').trim().toLowerCase()); };
  window.llLastEmail = function () { return read(LAST_EMAIL_KEY); };

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text) n.textContent = text;
    return n;
  }

  window.llEmailAuth = function (opts) {
    var form = opts.form;
    var emailInput = opts.emailInput;
    var submitBtn = opts.submitBtn;
    var statusEl = opts.statusEl;
    var devEl = opts.devEl;
    var sending = false;
    var idleLabel = submitBtn.textContent;

    // Code panel, inserted right after the form.
    var panel = el('div', { class: 'll-code-panel', hidden: '' });
    var sentTo = el('p', { class: 'll-code-sent' });
    var row = el('div', { class: 'll-code-row' });
    var codeInput = el('input', {
      id: 'llCode', type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code',
      maxlength: '7', placeholder: '6-digit code', 'aria-label': 'Sign-in code',
    });
    var codeBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Sign in');
    row.appendChild(codeInput);
    row.appendChild(codeBtn);
    var links = el('p', { class: 'll-code-links' });
    var resend = el('button', { type: 'button', class: 'll-linkbtn' }, 'Resend email');
    var change = el('button', { type: 'button', class: 'll-linkbtn' }, 'Use a different email');
    links.appendChild(resend);
    links.appendChild(document.createTextNode(' · '));
    links.appendChild(change);
    panel.appendChild(sentTo);
    panel.appendChild(row);
    panel.appendChild(links);
    form.parentNode.insertBefore(panel, form.nextSibling);

    function setStatus(msg, kind) {
      statusEl.className = 'status' + (kind ? ' ' + kind : '');
      statusEl.textContent = msg || '';
    }

    function showCodePanel(email) {
      form.hidden = true;
      panel.hidden = false;
      sentTo.innerHTML = '';
      sentTo.appendChild(document.createTextNode('We sent a sign-in link and code to '));
      sentTo.appendChild(el('strong', {}, email));
      sentTo.appendChild(document.createTextNode('. Click the link, or type the code here.'));
      codeInput.value = '';
      setTimeout(function () { codeInput.focus(); }, 30);
    }

    async function send() {
      if (sending) return;
      var email = (emailInput.value || '').trim();
      if (!email) { emailInput.focus(); return; }
      sending = true;
      submitBtn.disabled = true;
      resend.disabled = true;
      submitBtn.textContent = 'Sending…';
      setStatus('Sending…');
      if (devEl) devEl.style.display = 'none';
      try {
        var res = await fetch('/api/auth/magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(opts.buildPayload(email)),
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Could not send the sign-in email');
        window.llRememberEmail(email);
        if (opts.onSent) opts.onSent(data);
        showCodePanel(data.email || email);
        setStatus(data.sent === false ? (data.message || '') : '', data.sent === false ? '' : 'ok');
        if (data.dev_url && devEl) {
          devEl.style.display = 'block';
          devEl.innerHTML = 'Dev link: <a href="' + data.dev_url + '">' + data.dev_url + '</a>' +
            (data.dev_code ? ' · code <strong>' + data.dev_code + '</strong>' : '');
        }
      } catch (err) {
        setStatus(String(err.message || err), 'error');
      } finally {
        sending = false;
        submitBtn.disabled = false;
        resend.disabled = false;
        submitBtn.textContent = idleLabel;
      }
    }

    async function verifyCode() {
      var code = (codeInput.value || '').replace(/\D/g, '');
      if (code.length !== 6) { setStatus('Enter the 6-digit code from the email.', 'error'); codeInput.focus(); return; }
      codeBtn.disabled = true;
      codeBtn.textContent = 'Signing in…';
      setStatus('');
      try {
        var res = await fetch('/api/auth/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ email: (emailInput.value || '').trim(), code: code }),
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Could not sign in');
        if (window.llTrack && data.is_new) window.llTrack('sign_up', { method: 'email_code' });
        location.href = data.next || '/saas/app.html';
      } catch (err) {
        setStatus(String(err.message || err), 'error');
        codeBtn.disabled = false;
        codeBtn.textContent = 'Sign in';
        codeInput.select();
      }
    }

    codeInput.addEventListener('input', function () {
      var digits = codeInput.value.replace(/\D/g, '');
      if (digits.length === 6) verifyCode();
    });
    codeInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); verifyCode(); }
    });
    codeBtn.addEventListener('click', verifyCode);
    resend.addEventListener('click', send);
    change.addEventListener('click', function () {
      panel.hidden = true;
      form.hidden = false;
      setStatus('');
      emailInput.focus();
      emailInput.select();
    });

    return { send: send };
  };
})();

/** Workspace left nav — same Generate / Reports / Team / Settings / Owner on every product page. */
(function () {
  if (window.__llDashNavLoaded) return;
  window.__llDashNavLoaded = true;

  var SIDE_HTML =
    '<div class="side-label">Workspace</div>' +
    '<a href="/saas/app.html#generate" data-nav="generate"><span class="side-ico">＋</span> Generate</a>' +
    '<a href="/saas/app.html#reports" data-nav="reports"><span class="side-ico">▦</span> Reports</a>' +
    '<a href="/saas/app.html#team" data-nav="team" hidden><span class="side-ico">☰</span> Team</a>' +
    '<a href="/saas/onboarding.html" data-nav="settings"><span class="side-ico">◎</span> Settings</a>' +
    '<div class="side-sep" hidden></div>' +
    '<a href="/saas/admin.html" data-nav="owner" hidden><span class="side-ico">⚙</span> Owner console</a>';

  var WRAP_PAGES = /\/saas\/(admin|onboarding|pricing|faq|changelog)\.html$/;
  var AUTH_PAGES = /\/saas\/(login|signup|verify)\.html$/;

  function currentKey() {
    var path = location.pathname || "";
    if (path.indexOf("admin.html") !== -1) return "owner";
    if (path.indexOf("onboarding.html") !== -1) return "settings";
    var hash = (location.hash || "").replace(/^#/, "");
    if (hash === "reports" || hash === "team") return hash;
    if (path.indexOf("app.html") !== -1) return "generate";
    return "";
  }

  function applyUser(side, user) {
    if (!side) return;
    user = user || {};
    var team = side.querySelector('[data-nav="team"]') || document.getElementById("navTeam");
    if (team && user.is_brokerage_owner) team.hidden = false;
    var owner = side.querySelector('[data-nav="owner"]') || document.getElementById("navOwner");
    var sep = side.querySelector(".side-sep") || document.getElementById("adminSideSep");
    if (user.role === "admin") {
      if (owner) owner.hidden = false;
      if (sep) sep.hidden = false;
    }
    var key = currentKey();
    if (!key) return;
    side.querySelectorAll("a, button.side-link").forEach(function (el) {
      var nav = el.getAttribute("data-nav") || el.getAttribute("data-view") || "";
      if (el.id === "navSettings") nav = "settings";
      if (el.id === "navOwner") nav = "owner";
      el.classList.toggle("on", nav === key);
    });
  }

  function pagePath() {
    return (location.pathname || "").replace(/\/+$/, "") || "/";
  }

  function shouldWrap(user) {
    var path = pagePath();
    if (AUTH_PAGES.test(path) || AUTH_PAGES.test(path + ".html")) return false;
    if (document.querySelector(".dash-side")) return false;
    if (/\/saas\/(admin|onboarding)(\.html)?$/.test(path)) return true;
    if (!user || !(user.role || user.email || user.id)) return false;
    return WRAP_PAGES.test(path) || WRAP_PAGES.test(path + ".html");
  }

  function wrap() {
    var nav = document.querySelector("nav.ll-nav");
    if (!nav || !nav.parentNode) return null;
    var dash = document.createElement("div");
    dash.className = "dash";
    var aside = document.createElement("aside");
    aside.className = "dash-side";
    aside.setAttribute("aria-label", "Dashboard");
    aside.innerHTML = SIDE_HTML;
    var main = document.createElement("div");
    main.className = "dash-main";
    var node = nav.nextSibling;
    while (node) {
      var next = node.nextSibling;
      main.appendChild(node);
      node = next;
    }
    dash.appendChild(aside);
    dash.appendChild(main);
    nav.parentNode.insertBefore(dash, nav.nextSibling);
    document.body.classList.add("ll-has-dash");
    try {
      main.querySelectorAll(":scope > .container").forEach(function (el) {
        el.style.maxWidth = "none";
        el.style.paddingLeft = "0";
        el.style.paddingRight = "0";
      });
    } catch (err) {}
    return aside;
  }

  function mount(user) {
    var side = document.querySelector(".dash-side");
    if (!side && shouldWrap(user)) side = wrap();
    if (side) applyUser(side, user);
  }

  function start(user) {
    var go = function () { mount(user || {}); };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", go);
    } else {
      go();
    }
  }

  var existing = window.__llAuthUser;
  if (existing) {
    start(existing);
  } else {
    start({});
    fetch("/api/auth-status", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.authenticated && data.user) {
          window.__llAuthUser = data.user;
          mount(data.user);
        }
      })
      .catch(function () {});
  }
})();

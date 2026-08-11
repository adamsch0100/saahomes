/** ListLogic auth-aware nav — profile chip when logged in; no flash of guest CTAs. */
(function () {
  if (window.__llNavAuthLoaded) return;
  window.__llNavAuthLoaded = true;

  // Self-contained styles so homepage (no ll.css) and marketing pages all match.
  if (!document.getElementById("llNavAuthCss")) {
    const style = document.createElement("style");
    style.id = "llNavAuthCss";
    style.textContent =
      /* Hide guest Sign in / Trial until auth resolves — prevents flash */
      ".ll-auth-guest{visibility:hidden!important}" +
      "body.ll-auth-guest-ready .ll-auth-guest{visibility:visible!important}" +
      /* Account chip */
      ".ll-navacct{position:relative;display:inline-flex;align-items:center}" +
      ".ll-navacct-btn{" +
        "display:inline-flex;align-items:center;gap:8px;cursor:pointer;" +
        "background:#fff;border:1px solid #e6e0d4;border-radius:999px;" +
        "padding:5px 12px 5px 5px;font:inherit;color:#0b1220;" +
        "box-shadow:0 6px 18px -8px rgba(11,18,32,0.18);" +
        "transition:border-color .15s ease,box-shadow .15s ease" +
      "}" +
      ".ll-navacct-btn:hover{border-color:#0c3c6e;box-shadow:0 10px 24px -10px rgba(12,60,110,0.28)}" +
      ".ll-navacct-av{" +
        "width:30px;height:30px;border-radius:50%;flex:none;" +
        "background:linear-gradient(145deg,#0c3c6e,#1a5f9e);color:#fff;" +
        "display:inline-flex;align-items:center;justify-content:center;" +
        "font-size:.68rem;font-weight:800;letter-spacing:.02em" +
      "}" +
      ".ll-navacct-name{font-size:.84rem;font-weight:600}" +
      ".ll-navacct-caret{color:#5c6675;font-size:.75rem}" +
      ".ll-navacct-menu{" +
        "position:absolute;top:calc(100% + 8px);right:0;min-width:220px;" +
        "background:#fff;border:1px solid #e6e0d4;border-radius:14px;" +
        "box-shadow:0 22px 50px -18px rgba(8,30,55,0.3);padding:6px;z-index:90" +
      "}" +
      ".ll-navacct-head{padding:10px 12px;border-bottom:1px solid #e6e0d4;margin-bottom:4px;display:flex;flex-direction:column}" +
      ".ll-navacct-head strong{font-size:.88rem;color:#0b1220}" +
      ".ll-navacct-head span{font-size:.72rem;color:#5c6675}" +
      ".ll-navacct-menu a,.ll-navacct-menu button{" +
        "display:block;width:100%;text-align:left;text-decoration:none;" +
        "padding:9px 12px;border-radius:9px;font-size:.84rem;font-weight:500;" +
        "color:#0b1220;background:transparent;border:0;cursor:pointer;font-family:inherit" +
      "}" +
      ".ll-navacct-menu a:hover,.ll-navacct-menu button:hover{background:rgba(12,60,110,0.06)}" +
      /* Mobile: chip shouldn't stretch like nav links */
      ".nav-links .ll-navacct,.ll-nav-links .ll-navacct{margin-top:6px}" +
      ".nav-links .ll-navacct-btn,.ll-nav-links .ll-navacct-btn{width:100%;justify-content:flex-start}" +
      "@media(min-width:781px){.nav-links .ll-navacct-btn,.ll-nav-links .ll-navacct-btn{width:auto}}";
    document.head.appendChild(style);
  }

  function initials(name, email) {
    const n = (name || "").trim();
    if (n) {
      const parts = n.split(/\s+/).filter(Boolean);
      return (parts.slice(0, 2).map((p) => p[0]).join("") || "A").toUpperCase();
    }
    return ((email || "A")[0] || "A").toUpperCase();
  }

  function buildChip(user) {
    const name = (user.name || user.email || "Account").trim();
    const init = initials(user.name, user.email);
    const wrap = document.createElement("div");
    wrap.className = "ll-navacct";
    wrap.innerHTML =
      '<button type="button" class="ll-navacct-btn" aria-haspopup="menu" aria-expanded="false">' +
      '<span class="ll-navacct-av">' + init + "</span>" +
      '<span class="ll-navacct-name">' + name.split(" ")[0] + "</span>" +
      '<span class="ll-navacct-caret">▾</span></button>' +
      '<div class="ll-navacct-menu" role="menu" hidden>' +
      '<div class="ll-navacct-head"><strong>' + name + "</strong><span>" + (user.email || "") + "</span></div>" +
      '<a href="/saas/app.html" role="menuitem">Dashboard</a>' +
      '<a href="/saas/onboarding.html" role="menuitem">Settings</a>' +
      (user.role === "admin" ? '<a href="/saas/admin.html" role="menuitem">Owner console</a>' : "") +
      '<button type="button" class="ll-nav-signout" role="menuitem">Sign out</button>' +
      "</div>";
    return wrap;
  }

  function wireChip(wrap) {
    const btn = wrap.querySelector(".ll-navacct-btn");
    const menu = wrap.querySelector(".ll-navacct-menu");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) {
        menu.hidden = true;
        btn.setAttribute("aria-expanded", "false");
      }
    });
    const so = wrap.querySelector(".ll-nav-signout");
    if (so) {
      so.addEventListener("click", async () => {
        try { await fetch("/api/logout", { method: "POST", credentials: "same-origin" }); } catch (_) {}
        location.href = "/saas/login.html";
      });
    }
  }

  function showGuest() {
    document.body.classList.add("ll-auth-guest-ready");
  }

  function applyAuthed(user) {
    document.querySelectorAll("#navLinks, #llNavLinks").forEach((nav) => {
      const guests = nav.querySelectorAll(".ll-auth-guest, a[href*='login.html'], a[href*='signup.html']");
      // Prefer replacing the trial button position; fall back to end of nav
      const trial = nav.querySelector("a[href*='signup.html']") || nav.querySelector(".ll-auth-guest.btn");
      const chip = buildChip(user);
      if (trial) {
        nav.replaceChild(chip, trial);
      } else {
        nav.appendChild(chip);
      }
      // Remove remaining guest auth links (Sign in, duplicate trial)
      nav.querySelectorAll("a[href*='login.html'], a[href*='signup.html']").forEach((el) => el.remove());
      nav.querySelectorAll(".ll-auth-guest").forEach((el) => {
        if (el.parentNode) el.remove();
      });
      wireChip(chip);
    });
  }

  // Mark guest links if pages haven't yet — so hide-until-ready CSS applies
  document.querySelectorAll("#navLinks, #llNavLinks").forEach((nav) => {
    nav.querySelectorAll('a[href*="login.html"], a[href*="signup.html"]').forEach((a) => {
      a.classList.add("ll-auth-guest");
    });
  });

  fetch("/api/auth-status", { credentials: "same-origin" })
    .then((r) => r.json())
    .then((data) => {
      if (data && data.authenticated && data.user) {
        applyAuthed(data.user);
      } else {
        showGuest();
      }
    })
    .catch(() => showGuest());
})();

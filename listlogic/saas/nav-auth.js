/** ListLogic auth-aware nav — swaps Sign in / Start free trial for a profile chip when logged in. */
(function () {
  if (window.__llNavAuthLoaded) return;
  window.__llNavAuthLoaded = true;

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
      '<button type="button" class="ll-navacct-btn" id="llNavAcctBtn" aria-haspopup="menu" aria-expanded="false">' +
      '<span class="ll-navacct-av">' + init + "</span>" +
      '<span class="ll-navacct-name">' + name.split(" ")[0] + "</span>" +
      '<span class="ll-navacct-caret">▾</span></button>' +
      '<div class="ll-navacct-menu" id="llNavAcctMenu" role="menu" hidden>' +
      '<div class="ll-navacct-head"><strong>' + name + "</strong><span>" + (user.email || "") + "</span></div>" +
      '<a href="/saas/app.html" role="menuitem">Dashboard</a>' +
      '<a href="/saas/onboarding.html" role="menuitem">Settings</a>' +
      (user.role === "admin" ? '<a href="/saas/admin.html" role="menuitem">Owner console</a>' : "") +
      '<button type="button" id="llNavSignOut" role="menuitem">Sign out</button>' +
      "</div>";
    return wrap;
  }

  function wireChip(wrap) {
    const btn = wrap.querySelector("#llNavAcctBtn");
    const menu = wrap.querySelector("#llNavAcctMenu");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) menu.hidden = true;
    });
    const so = wrap.querySelector("#llNavSignOut");
    if (so) {
      so.addEventListener("click", async () => {
        try { await fetch("/api/logout", { method: "POST", credentials: "same-origin" }); } catch (_) {}
        location.href = "/saas/login.html";
      });
    }
  }

  fetch("/api/auth-status", { credentials: "same-origin" })
    .then((r) => r.json())
    .then((data) => {
      if (!data || !data.authenticated || !data.user) return;
      // Find nav containers that hold a Sign in link
      document.querySelectorAll("#navLinks, #llNavLinks").forEach((nav) => {
        const signin = nav.querySelector('a[href*="login.html"]');
        if (!signin) return;
        const trial = nav.querySelector('a[href*="signup.html"]');
        const chip = buildChip(data.user);
        // Replace the trial button with the chip, drop the sign-in link
        if (trial) {
          nav.replaceChild(chip, trial);
        } else {
          nav.appendChild(chip);
        }
        signin.remove();
        wireChip(chip);
      });
    })
    .catch(() => {});
})();

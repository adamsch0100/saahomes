/** ListLogic Assistant — floating help + feedback (logged-in only). */
(function () {
  if (window.__llAssistantLoaded) return;
  window.__llAssistantLoaded = true;

  const css = `
  .ll-as-btn{position:fixed;right:16px;bottom:16px;z-index:9998;background:#0c3c6e;color:#fff;border:none;border-radius:999px;padding:12px 16px;font:600 13px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(12,60,110,.35);display:none}
  .ll-as-btn.on{display:inline-flex;align-items:center;gap:8px}
  .ll-as-btn:hover{background:#1a5f9e}
  .ll-as-panel{display:none;position:fixed;right:16px;bottom:70px;z-index:9999;width:min(400px,calc(100vw - 24px));height:min(560px,calc(100vh - 100px));background:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(8,30,55,.28);font-family:system-ui,sans-serif;color:#1a2332;flex-direction:column;overflow:hidden;border:1px solid #d8e0ea}
  .ll-as-panel.on{display:flex}
  .ll-as-head{background:linear-gradient(135deg,#0c3c6e,#1a5f9e);color:#fff;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:8px}
  .ll-as-head strong{font-size:.95rem}
  .ll-as-head span{display:block;font-size:.68rem;opacity:.85;margin-top:2px}
  .ll-as-head button{background:transparent;border:none;color:#fff;font-size:1.2rem;cursor:pointer;line-height:1}
  .ll-as-tabs{display:flex;border-bottom:1px solid #d8e0ea;background:#f8fafc}
  .ll-as-tabs button{flex:1;border:none;background:transparent;padding:10px;font:700 12px/1 system-ui,sans-serif;color:#5a6a7c;cursor:pointer}
  .ll-as-tabs button.on{color:#0c3c6e;box-shadow:inset 0 -2px 0 #0c3c6e}
  .ll-as-body{flex:1;overflow:auto;padding:12px;background:#f4f7fb}
  .ll-as-msg{margin:0 0 10px;padding:10px 12px;border-radius:12px;font-size:.86rem;line-height:1.45;max-width:92%;white-space:pre-wrap}
  .ll-as-msg.bot{background:#fff;border:1px solid #d8e0ea;color:#1a2332}
  .ll-as-msg.user{background:#0c3c6e;color:#fff;margin-left:auto}
  .ll-as-foot{border-top:1px solid #d8e0ea;padding:10px;background:#fff}
  .ll-as-foot textarea,.ll-as-pane input,.ll-as-pane select,.ll-as-pane textarea{width:100%;box-sizing:border-box;border:1px solid #d8e0ea;border-radius:10px;padding:9px 10px;font:inherit}
  .ll-as-foot textarea{min-height:64px;resize:vertical}
  .ll-as-actions{display:flex;gap:8px;margin-top:8px;justify-content:flex-end}
  .ll-as-actions button{border:none;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;font-size:.82rem}
  .ll-as-send{background:#0c3c6e;color:#fff}
  .ll-as-secondary{background:#eef2f7;color:#0c3c6e}
  .ll-as-pane{display:none}
  .ll-as-pane.on{display:block}
  .ll-as-pane label{display:block;font-size:.72rem;color:#5a6a7c;margin:8px 0 4px}
  .ll-as-status{font-size:.78rem;color:#5a6a7c;margin-top:8px}
  .ll-as-status.err{color:#b91c1c}
  .ll-as-status.ok{color:#0d7a4f}
  .ll-as-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
  .ll-as-chips button{border:1px solid #d8e0ea;background:#fff;border-radius:999px;padding:6px 10px;font-size:.72rem;font-weight:700;color:#0c3c6e;cursor:pointer}
  @media print{.ll-as-btn,.ll-as-panel,#llSampleBar{display:none!important}}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ll-as-btn";
  btn.innerHTML = "<span aria-hidden='true'>✦</span> Ask ListLogic";
  document.body.appendChild(btn);

  const panel = document.createElement("div");
  panel.className = "ll-as-panel";
  panel.innerHTML = `
    <div class="ll-as-head">
      <div><strong>ListLogic Assistant</strong><span>Help · feedback · product Q&amp;A</span></div>
      <button type="button" id="llAsClose" aria-label="Close">×</button>
    </div>
    <div class="ll-as-tabs">
      <button type="button" class="on" data-tab="chat">Ask</button>
      <button type="button" data-tab="feedback">Feedback</button>
    </div>
    <div class="ll-as-body" id="llAsBody">
      <div class="ll-as-pane on" id="llAsChatPane">
        <div class="ll-as-chips" id="llAsChips">
          <button type="button" data-q="How does signup and unlock work?">Signup &amp; unlock</button>
          <button type="button" data-q="How do I try the sample listing?">Sample demo</button>
          <button type="button" data-q="How do I search a market or upload an MLS export?">Search or Upload</button>
          <button type="button" data-q="What's the difference between the live story, seller packet, and flipbook?">Print packs</button>
        </div>
        <div id="llAsMsgs"></div>
      </div>
      <div class="ll-as-pane" id="llAsFbPane">
        <p style="font-size:.86rem;color:#5a6a7c;margin:0 0 8px;line-height:1.4">Send a bug or suggestion straight to Adam. The assistant can also help you phrase it in the Ask tab.</p>
        <label for="llAsCat">Category</label>
        <select id="llAsCat"><option value="bug">Bug</option><option value="suggestion" selected>Suggestion</option><option value="other">Other</option></select>
        <label for="llAsEmail">Email</label>
        <input id="llAsEmail" type="email" placeholder="you@brokerage.com" />
        <label for="llAsFbMsg">Message</label>
        <textarea id="llAsFbMsg" placeholder="What happened / what would help…"></textarea>
        <div class="ll-as-actions"><button type="button" class="ll-as-send" id="llAsFbSend">Send feedback</button></div>
        <div class="ll-as-status" id="llAsFbStatus"></div>
      </div>
    </div>
    <div class="ll-as-foot" id="llAsChatFoot">
      <textarea id="llAsInput" placeholder="Ask how trials, demos, exports, or pricing work…"></textarea>
      <div class="ll-as-actions">
        <button type="button" class="ll-as-secondary" id="llAsClear">Clear</button>
        <button type="button" class="ll-as-send" id="llAsSend">Send</button>
      </div>
      <div class="ll-as-status" id="llAsStatus"></div>
    </div>`;
  document.body.appendChild(panel);

  const msgsEl = document.getElementById("llAsMsgs");
  const statusEl = document.getElementById("llAsStatus");
  let history = [];
  let userEmail = "";
  let busy = false;
  let conversationId = "";
  try {
    conversationId = sessionStorage.getItem("ll_as_convo") || "";
    if (!conversationId) {
      conversationId = "c_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("ll_as_convo", conversationId);
    }
  } catch (_) {
    conversationId = "c_" + Date.now().toString(36);
  }

  function addMsg(role, text) {
    const div = document.createElement("div");
    div.className = "ll-as-msg " + (role === "user" ? "user" : "bot");
    div.textContent = text;
    msgsEl.appendChild(div);
    msgsEl.parentElement.scrollTop = msgsEl.parentElement.scrollHeight;
  }

  function setTab(tab) {
    panel.querySelectorAll(".ll-as-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    document.getElementById("llAsChatPane").classList.toggle("on", tab === "chat");
    document.getElementById("llAsFbPane").classList.toggle("on", tab === "feedback");
    document.getElementById("llAsChatFoot").style.display = tab === "chat" ? "block" : "none";
  }

  panel.querySelectorAll(".ll-as-tabs button").forEach((b) => {
    b.addEventListener("click", () => setTab(b.dataset.tab));
  });

  btn.addEventListener("click", () => panel.classList.toggle("on"));
  document.getElementById("llAsClose").addEventListener("click", () => panel.classList.remove("on"));

  document.getElementById("llAsChips").addEventListener("click", (e) => {
    const chip = e.target.closest("button[data-q]");
    if (!chip || busy) return;
    document.getElementById("llAsInput").value = chip.dataset.q;
    sendChat();
  });

  document.getElementById("llAsClear").addEventListener("click", () => {
    history = [];
    msgsEl.innerHTML = "";
    statusEl.textContent = "";
    addMsg("bot", "Hi — I’m the ListLogic assistant. Ask about trials, the sample demo, Search vs Upload, presentations, or tell me about a bug/suggestion.");
  });

  async function sendChat() {
    const input = document.getElementById("llAsInput");
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true;
    input.value = "";
    addMsg("user", text);
    history.push({ role: "user", content: text });
    statusEl.textContent = "Thinking…";
    statusEl.className = "ll-as-status";
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          page_url: location.href,
          conversation_id: conversationId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        statusEl.className = "ll-as-status err";
        statusEl.textContent = "Sign in to use the assistant.";
        return;
      }
      const reply = data.reply || data.detail || "No reply";
      // Strip feedback fence from display if present
      const display = String(reply).replace(/```feedback[\s\S]*?```/gi, "").trim() || reply;
      addMsg("bot", display);
      history.push({ role: "assistant", content: reply });
      if (data.feedback_draft && data.feedback_draft.message) {
        document.getElementById("llAsCat").value = data.feedback_draft.category || "suggestion";
        document.getElementById("llAsFbMsg").value = data.feedback_draft.message;
        setTab("feedback");
        statusEl.className = "ll-as-status ok";
        statusEl.textContent = "Drafted feedback — review and tap Send feedback.";
      } else {
        statusEl.textContent = data.model ? "Model: " + data.model : "";
      }
    } catch (err) {
      statusEl.className = "ll-as-status err";
      statusEl.textContent = String(err.message || err);
    } finally {
      busy = false;
    }
  }

  document.getElementById("llAsSend").addEventListener("click", sendChat);
  document.getElementById("llAsInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });

  document.getElementById("llAsFbSend").addEventListener("click", async () => {
    const st = document.getElementById("llAsFbStatus");
    st.className = "ll-as-status";
    st.textContent = "Sending…";
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: document.getElementById("llAsCat").value,
          email: document.getElementById("llAsEmail").value.trim() || userEmail,
          message: document.getElementById("llAsFbMsg").value.trim(),
          page_url: location.href,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not send");
      st.className = "ll-as-status ok";
      st.textContent = "Thanks — Adam got it.";
      document.getElementById("llAsFbMsg").value = "";
    } catch (err) {
      st.className = "ll-as-status err";
      st.textContent = String(err.message || err);
    }
  });

  function guestSampleAuthHtml() {
    return (
      "<span>Sample listing — free forever. Create an account to build yours; unlock at Generate.</span>" +
      '<span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<a href="/saas/login.html" style="color:#fff;background:transparent;border:1px solid rgba(255,255,255,.45);text-decoration:none;padding:8px 12px;border-radius:8px;font-weight:700">Sign in</a>' +
      '<a href="/saas/signup.html" style="background:#c9a227;color:#0c3c6e;text-decoration:none;padding:8px 12px;border-radius:8px;font-weight:700">Create account</a>' +
      "</span>"
    );
  }

  // Sample banner (public demo) — keep agent chip / sticky spine below it
  const isSample = new URLSearchParams(location.search).get("sample") === "1";
  if (isSample) {
    const bar = document.createElement("div");
    bar.id = "llSampleBar";
    bar.style.cssText =
      "position:sticky;top:0;z-index:9000;background:#0c3c6e;color:#fff;padding:10px 14px;font:600 13px/1.35 system-ui,sans-serif;display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between";
    document.body.prepend(bar);
    document.body.classList.add("ll-sample");

    const offsetSampleChrome = () => {
      const h = Math.ceil(bar.getBoundingClientRect().height || 52);
      document.documentElement.style.setProperty("--ll-sample-bar-h", h + "px");
    };
    if (!document.getElementById("llSampleOffsetStyle")) {
      const style = document.createElement("style");
      style.id = "llSampleOffsetStyle";
      style.textContent =
        "body.ll-sample .agent-menu-wrap{top:calc(var(--ll-sample-bar-h,52px) + 12px)}" +
        "body.ll-sample .spine{top:var(--ll-sample-bar-h,52px)}" +
        "@media(max-width:560px){body.ll-sample .agent-menu-wrap{top:auto}}";
      document.head.appendChild(style);
    }

    // Render banner contents based on auth: logged-in users don't need a trial CTA
    fetch("/api/auth-status", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => {
        const authed = !!(data && data.authenticated && data.user);
        if (authed) {
          const name = ((data.user.name || "").split(" ")[0] || "there");
          bar.innerHTML =
            "<span>Signed in as <strong>" + name + "</strong> — exploring the sample listing.</span>" +
            '<a href="/saas/app.html" style="background:#c9a227;color:#0c3c6e;text-decoration:none;padding:8px 12px;border-radius:8px;font-weight:700">Go to my dashboard</a>';
        } else {
          bar.innerHTML = guestSampleAuthHtml();
          const chip = document.getElementById("agentMenuWrap");
          if (chip) chip.style.display = "none";
        }
        offsetSampleChrome();
      })
      .catch(() => {
        bar.innerHTML = guestSampleAuthHtml();
        const chip = document.getElementById("agentMenuWrap");
        if (chip) chip.style.display = "none";
        offsetSampleChrome();
      });

    offsetSampleChrome();
    window.addEventListener("resize", offsetSampleChrome);
  }

  fetch("/api/auth-status")
    .then((r) => r.json())
    .then((data) => {
      if (!data.authenticated) return;
      userEmail = (data.user && data.user.email) || "";
      if (userEmail) document.getElementById("llAsEmail").value = userEmail;
      btn.classList.add("on");
      if (data.user && data.user.role === "admin") {
        let adminLink = document.getElementById("menuAdminLink");
        if (!adminLink) {
          const menu = document.getElementById("agentMenu");
          const signOut = document.getElementById("menuSignOut");
          if (menu && signOut) {
            adminLink = document.createElement("a");
            adminLink.href = "/saas/admin.html";
            adminLink.id = "menuAdminLink";
            adminLink.setAttribute("role", "menuitem");
            adminLink.innerHTML =
              '<span class="mi-ico">⚙</span><span class="mi-copy"><strong>Owner console</strong><span>Users, reports &amp; AI chats</span></span>';
            menu.insertBefore(adminLink, signOut);
          }
        }
        if (adminLink) adminLink.hidden = false;
      }
      addMsg(
        "bot",
        "Hi" +
          (data.user && data.user.name ? " " + data.user.name.split(" ")[0] : "") +
          " — ask me about trials, the sample demo, Search vs Upload, presentations, or switch to Feedback to send Adam a bug/suggestion."
      );
    })
    .catch(() => {});
})();

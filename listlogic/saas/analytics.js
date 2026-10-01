/** ListLogic analytics — uses site-wide GA4 tag (G-WHGZQDZ6ZG); llTrack for custom events */
(function () {
  var DEFAULT_ID = "G-WHGZQDZ6ZG";
  var MEASUREMENT_ID = "";
  var queue = [];

  function gtag() {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(arguments);
  }
  // Prefer the page-level Google tag if already defined in <head>
  window.gtag = window.gtag || gtag;

  function send(item) {
    var settled = false;
    var timeout = setTimeout(finish, 1000);
    function finish() {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      item.resolve();
    }
    try {
      window.gtag("event", item.eventName, Object.assign({}, item.payload, {
        event_callback: finish,
        event_timeout: 1000
      }));
    } catch (e) {
      finish();
    }
  }

  window.llTrack = function (eventName, params) {
    params = params || {};
    try {
      var utm = {};
      var qs = new URLSearchParams(location.search);
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) {
        if (qs.get(k)) utm[k] = qs.get(k);
      });
      var payload = Object.assign({}, utm, params);
      return new Promise(function (resolve) {
        var settled = false;
        var fallback = setTimeout(finish, 1500);
        function finish() {
          if (settled) return;
          settled = true;
          clearTimeout(fallback);
          resolve();
        }
        var item = { eventName: eventName, payload: payload, resolve: finish };
        var pageTag = document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
        if (MEASUREMENT_ID || pageTag) send(item);
        else queue.push(item);
      });
    } catch (e) {
      return Promise.resolve();
    }
  };

  function boot(id) {
    MEASUREMENT_ID = (id || DEFAULT_ID || "").trim();
    if (!MEASUREMENT_ID) return;
    // Head snippet already loaded gtag.js + config — do not inject a second tag.
    var existing = document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
    if (!existing) {
      window.gtag = window.gtag || gtag;
      var s = document.createElement("script");
      s.async = true;
      s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(MEASUREMENT_ID);
      document.head.appendChild(s);
      window.gtag("js", new Date());
      window.gtag("config", MEASUREMENT_ID, { send_page_view: true });
    }
    queue.forEach(send);
    queue = [];
  }

  // Prefer env override from public-config when set; otherwise site default.
  fetch("/api/public-config", { credentials: "same-origin" })
    .then(function (r) { return r.json(); })
    .then(function (cfg) { boot((cfg && cfg.ga4) || DEFAULT_ID); })
    .catch(function () { boot(DEFAULT_ID); });

  // Persist UTMs for later checkout attribution
  try {
    var qs = new URLSearchParams(location.search);
    var store = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) {
      if (qs.get(k)) store[k] = qs.get(k);
    });
    if (Object.keys(store).length) {
      sessionStorage.setItem("ll_utm", JSON.stringify(store));
    }
  } catch (e) {}
})();

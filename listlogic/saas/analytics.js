/** ListLogic analytics — GA4 when configured via /api/public-config */
(function () {
  var MEASUREMENT_ID = "";
  var queue = [];

  function gtag() {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(arguments);
  }
  window.gtag = window.gtag || gtag;
  window.llTrack = function (eventName, params) {
    params = params || {};
    try {
      var utm = {};
      var qs = new URLSearchParams(location.search);
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) {
        if (qs.get(k)) utm[k] = qs.get(k);
      });
      var payload = Object.assign({}, utm, params);
      if (!MEASUREMENT_ID) {
        queue.push([eventName, payload]);
        return;
      }
      gtag("event", eventName, payload);
    } catch (e) {}
  };

  function boot(id) {
    MEASUREMENT_ID = (id || "").trim();
    if (!MEASUREMENT_ID) return;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(MEASUREMENT_ID);
    document.head.appendChild(s);
    gtag("js", new Date());
    gtag("config", MEASUREMENT_ID, { send_page_view: true });
    queue.forEach(function (item) {
      gtag("event", item[0], item[1]);
    });
    queue = [];
  }

  fetch("/api/public-config", { credentials: "same-origin" })
    .then(function (r) { return r.json(); })
    .then(function (cfg) { boot(cfg && cfg.ga4); })
    .catch(function () {});

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

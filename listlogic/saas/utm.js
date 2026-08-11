/** Append UTM params from session to signup/demo links with data-ll-utm */
(function () {
  function utmQuery() {
    try {
      var raw = sessionStorage.getItem("ll_utm");
      if (!raw) return "";
      var o = JSON.parse(raw);
      var p = new URLSearchParams();
      Object.keys(o).forEach(function (k) { if (o[k]) p.set(k, o[k]); });
      var s = p.toString();
      return s ? "?" + s : "";
    } catch (e) {
      return "";
    }
  }
  function apply() {
    var q = utmQuery();
    if (!q) return;
    document.querySelectorAll("a[data-ll-utm]").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (!href || href.indexOf("?") >= 0 || href.startsWith("#") || href.startsWith("mailto:")) return;
      a.setAttribute("href", href + q);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
})();

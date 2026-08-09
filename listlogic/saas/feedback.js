/** Back-compat: load ListLogic Assistant (help + feedback). */
(function () {
  var s = document.createElement("script");
  s.src = "/saas/assistant.js";
  s.async = true;
  document.head.appendChild(s);
})();

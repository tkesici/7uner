/* 7uner – page switching (#tuner, #level-test) */
(function () {
  "use strict";
  const pages = { "tuner": "page-tuner", "level-test": "page-test" };

  function go() {
    let p = (location.hash || "").slice(1);
    if (!pages[p]) p = "tuner";
    Object.keys(pages).forEach((k) => { document.getElementById(pages[k]).hidden = k !== p; });
    document.querySelectorAll(".sitenav a").forEach((a) => {
      if (a.dataset.page === p) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (p !== "tuner" && window.tuner && window.tuner.isRunning()) window.tuner.stop();
    if (p !== "level-test" && window.levelTest) window.levelTest.pause();
    if (p === "tuner" && window.tuner) window.tuner.resize();
    document.title = p === "level-test" ? "Guitar level test – 7uner" : "7uner – chromatic tuner";
  }

  window.addEventListener("hashchange", go);
  go();
})();
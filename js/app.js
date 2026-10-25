/* 7uner – page switching (#tuner, #learn) and the Learn instrument picker */
(function () {
  "use strict";
  const pages = { "tuner": "page-tuner", "learn": "page-test" };

  /* Learn: instrument picker. Only the guitar has content for now. */
  const LEARN = [
    { id: "guitar", label: "Guitar", available: true },
    { id: "bass", label: "Bass", available: false },
    { id: "ukulele", label: "Ukulele", available: false },
    { id: "violin", label: "Violin", available: false }
  ];
  const icons = (window.tuner && window.tuner.icons) || {};
  const picker = document.getElementById("lModes");
  picker.innerHTML = LEARN.map((m) =>
      '<button role="radio" data-instr="' + m.id + '" aria-checked="' + (m.id === "guitar") + '"' +
      (m.available ? "" : ' disabled title="Coming soon"') + ">" +
      '<svg viewBox="0 0 32 32" aria-hidden="true">' + (icons[m.id] || "") + "</svg>" +
      "<span>" + m.label + "</span></button>").join("");

  function go() {
    let p = (location.hash || "").slice(1);
    if (!pages[p]) p = "tuner";
    Object.keys(pages).forEach((k) => { document.getElementById(pages[k]).hidden = k !== p; });
    document.querySelectorAll(".sitenav a").forEach((a) => {
      if (a.dataset.page === p) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (p !== "tuner" && window.tuner && window.tuner.isRunning()) window.tuner.stop();
    if (p !== "learn" && window.levelTest) window.levelTest.pause();
    if (p === "tuner" && window.tuner) window.tuner.resize();
    document.title = p === "learn" ? "Learn – 7uner" : "7uner – chromatic tuner";
  }

  window.addEventListener("hashchange", go);
  go();
})();
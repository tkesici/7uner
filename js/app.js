/* 7uner – page switching (#tuner, #practice, #tab-studio), the settings
   and help bubbles in the bottom-left corner, and the Practice instrument picker */
(function () {
  "use strict";
  const pages = { "tuner": "page-tuner", "practice": "page-test", "tab-studio": "page-studio" };
  const titles = { "tuner": "7uner – online tuner, guitar practice and tab player", "practice": "Practice – 7uner", "tab-studio": "Tab Studio – 7uner" };
  const aliases = { "learn": "practice" }; // older links

  /* Practice: instrument picker. Only the guitar has content for now. */
  const PRACTICE = [
    { id: "guitar", label: "Guitar", available: true },
    { id: "bass", label: "Bass", available: false },
    { id: "ukulele", label: "Ukulele", available: false },
    { id: "violin", label: "Violin", available: false }
  ];
  const icons = (window.tuner && window.tuner.icons) || {};
  const picker = document.getElementById("lModes");
  picker.innerHTML = PRACTICE.map((m) =>
      '<button role="radio" data-instr="' + m.id + '" aria-checked="' + (m.id === "guitar") + '"' +
      (m.available ? "" : ' disabled title="Coming soon"') + ">" +
      '<svg viewBox="0 0 32 32" aria-hidden="true">' + (icons[m.id] || "") + "</svg>" +
      "<span>" + m.label + "</span></button>").join("");

  function go() {
    let p = (location.hash || "").slice(1);
    p = aliases[p] || p;
    if (!pages[p]) p = "tuner";
    Object.keys(pages).forEach((k) => { document.getElementById(pages[k]).hidden = k !== p; });
    document.querySelectorAll(".sitenav a").forEach((a) => {
      if (a.dataset.page === p) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (p !== "tuner" && window.tuner && window.tuner.isRunning()) window.tuner.stop();
    if (p !== "practice" && window.practice) window.practice.pause();
    if (p !== "tab-studio" && window.tabStudio) window.tabStudio.pause();
    if (p === "tuner" && window.tuner) window.tuner.resize();
    if (p === "practice" && window.practice) window.practice.show();
    if (p === "tab-studio" && window.tabStudio) window.tabStudio.show();
    // one amp (amp.js) and metronome (metronome.js) for Practice and Tab Studio,
    // shown beside the open page's heading
    const slot = document.querySelector("#" + pages[p] + " .amp-slot"), rig = document.getElementById("rig");
    if (slot && rig.parentElement !== slot) slot.appendChild(rig);
    document.title = titles[p];
    // help for the page that's open
    document.querySelectorAll("[data-help]").forEach((x) => { x.hidden = x.dataset.help !== p; });
  }

  /* settings and help: buttons in the bottom-left corner, each opening a bubble just above it */
  const POPS = [["cGearBtn", "cSettings"], ["cInfoBtn", "cInfo"]].map(([b, p]) => [document.getElementById(b), document.getElementById(p)]);
  function closePops() { POPS.forEach(([b, p]) => { p.hidden = true; b.setAttribute("aria-expanded", "false"); }); }
  POPS.forEach(([b, p]) => b.addEventListener("click", () => {
    const open = p.hidden;
    closePops();
    if (open) { p.hidden = false; b.setAttribute("aria-expanded", "true"); }
  }));
  document.addEventListener("click", (e) => { if (!e.target.closest(".corner")) closePops(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePops(); });

  window.addEventListener("hashchange", go);
  go();

  /* offline support (sw.js); service workers need HTTPS or localhost */
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }
})();
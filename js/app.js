/* 7uner – page switching (#tuner, #practice, #tab-studio), the settings
   and help bubbles in the bottom-left corner, and the Practice instrument picker */
(function () {
  "use strict";
  const pages = { "tuner": "page-tuner", "practice": "page-test", "tab-studio": "page-studio" };
  const titles = { "tuner": "7uner – online tuner, guitar practice and tab player", "practice": "Practice – 7uner", "tab-studio": "Tab Studio – 7uner" };
  const aliases = { "learn": "practice" }; // older links

  /* Practice: the guitar's exercises, or Voice (voice.js), for singing */
  const PRACTICE = [
    { id: "guitar", label: "Guitar", lede: "" },
    { id: "voice", label: "Voice", lede: "Sing and see your pitch as a line. Find your range, then work through listen-and-sing exercises set in it, and see how far to move a song to fit your voice." }
  ];
  const icons = (window.tuner && window.tuner.icons) || {};
  const picker = document.getElementById("lModes"), lede = document.getElementById("pLede");
  PRACTICE[0].lede = lede.textContent;
  let instr = "guitar";
  try { if (localStorage.getItem("7uner.practice.instr") === "voice") instr = "voice"; } catch (e) {}
  picker.innerHTML = PRACTICE.map((m) =>
      '<button role="radio" data-instr="' + m.id + '" aria-checked="false">' +
      '<svg viewBox="0 0 32 32" aria-hidden="true">' + (icons[m.id] || "") + "</svg>" +
      "<span>" + m.label + "</span></button>").join("");
  // show the picked instrument's part of the page; open: Practice is the page on screen
  function showInstr(open) {
    const voice = instr === "voice";
    picker.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.instr === instr;
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    lede.textContent = PRACTICE.find((m) => m.id === instr).lede;
    document.getElementById("sec-test").hidden = voice;
    document.querySelector("#page-test .amp-slot").hidden = voice;
    if (!window.voice) return;
    if (!voice) window.voice.hide();
    if (!open) return;
    if (voice) { if (window.practice) window.practice.pause(); window.voice.show(false); }
    else if (window.practice) window.practice.show();
  }
  function setInstr(id) {
    if (id === instr || !PRACTICE.some((m) => m.id === id)) return;
    instr = id;
    try { localStorage.setItem("7uner.practice.instr", id); } catch (e) {}
    showInstr(!document.getElementById("page-test").hidden);
  }
  picker.addEventListener("click", (e) => { const b = e.target.closest("button[data-instr]"); if (b) setInstr(b.dataset.instr); });
  picker.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const i = PRACTICE.findIndex((m) => m.id === instr), next = PRACTICE[(i + d + PRACTICE.length) % PRACTICE.length].id;
    setInstr(next);
    picker.querySelector('[data-instr="' + next + '"]').focus();
  });

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
    if (p !== "practice" && window.voice) window.voice.stop();
    if (p !== "practice" && window.practice) window.practice.pause();
    if (p !== "tab-studio" && window.tabStudio) window.tabStudio.pause();
    if (p === "tuner" && window.tuner) window.tuner.resize();
    if (p === "practice") showInstr(true);
    if (p === "tab-studio" && window.tabStudio) window.tabStudio.show();
    // one amp (amp.js) and metronome (metronome.js) for Practice and Tab Studio,
    // shown beside the open page's heading
    const slot = document.querySelector("#" + pages[p] + " .amp-slot"), rig = document.getElementById("rig");
    if (slot && rig.parentElement !== slot) slot.appendChild(rig);
    document.title = titles[p];
    document.getElementById("tModes").hidden = p !== "tuner";
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
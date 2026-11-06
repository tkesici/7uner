/* 7uner – page switching (#tuner, #practice, #tab-studio), the help and
   settings bubble in the header, the Practice instrument picker, and the
   rig's fold on phones */
(function () {
  "use strict";
  const pages = { "tuner": "page-tuner", "practice": "page-test", "tab-studio": "page-studio" };
  const titles = { "tuner": "7uner – online tuner, guitar practice and tab player", "practice": "Practice – 7uner", "tab-studio": "Tab Studio – 7uner" };
  const aliases = { "learn": "practice" }; // older links

  /* Practice: the guitar's exercises, or Voice (voice.js), for singing; the
     picker sits in the header, like the tuner's, and looks the same */
  const PRACTICE = [{ id: "guitar", label: "Guitar" }, { id: "voice", label: "Voice" }];
  const icons = (window.tuner && window.tuner.icons) || {};
  const picker = document.getElementById("lModes");
  let instr = "guitar";
  try { if (localStorage.getItem("7uner.practice.instr") === "voice") instr = "voice"; } catch (e) {}
  picker.innerHTML = PRACTICE.map((m) =>
      '<button role="radio" data-instr="' + m.id + '" aria-checked="false" title="' + m.label + '">' +
      '<svg viewBox="0 0 32 32" aria-hidden="true">' + (icons[m.id] || "") + "</svg>" +
      '<span class="vh">' + m.label + "</span></button>").join("");
  // show the picked instrument's part of the page; open: Practice is the page on screen
  function showInstr(open) {
    const voice = instr === "voice";
    picker.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.instr === instr;
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    document.getElementById("sec-test").hidden = voice;
    document.querySelector("#page-test .amp-slot").hidden = voice;
    if (!window.voice) return;
    if (!voice) window.voice.hide();
    if (!open) return;
    if (voice) { if (window.practice) window.practice.pause(); window.voice.show(); }
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
    closePop();
    if (p !== "tuner" && window.tuner && window.tuner.isRunning()) window.tuner.stop();
    if (p !== "practice" && window.voice) window.voice.stop();
    if (p !== "practice" && window.practice) window.practice.pause();
    if (p !== "tab-studio" && window.tabStudio) window.tabStudio.pause();
    if (p === "tuner" && window.tuner) { window.tuner.resize(); window.tuner.autoStart(); }
    if (p === "practice") showInstr(true);
    if (p === "tab-studio" && window.tabStudio) window.tabStudio.show();
    // one amp (amp.js) and metronome (metronome.js) for Practice and Tab Studio,
    // shown beside the open page's heading
    const slot = document.querySelector("#" + pages[p] + " .amp-slot"), rig = document.getElementById("rig");
    if (slot && rig.parentElement !== slot) slot.appendChild(rig);
    document.title = titles[p];
    // the open page's instrument picker in the header's middle
    document.getElementById("tModes").hidden = p !== "tuner";
    picker.hidden = p !== "practice";
    // help for the page that's open; the string setting only on the tuner
    document.querySelectorAll("[data-help]").forEach((x) => { x.hidden = x.dataset.help !== p; });
    document.getElementById("tAutoRow").classList.toggle("offpage", p !== "tuner");
  }

  /* help and settings: one button at the right of the header, opening a bubble under it */
  const infoBtn = document.getElementById("cInfoBtn"), info = document.getElementById("cInfo");
  function closePop() { info.hidden = true; infoBtn.setAttribute("aria-expanded", "false"); }
  infoBtn.addEventListener("click", () => {
    const open = info.hidden;
    info.hidden = !open;
    infoBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".hright")) closePop(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !info.hidden) { closePop(); infoBtn.focus(); } });

  /* on a phone the amp and metronome fold into a strip above the page, so
     the exercise or the song comes first; a tap opens them */
  const rig = document.getElementById("rig"), rigBar = document.getElementById("rigBar");
  rigBar.addEventListener("click", () => {
    const open = !rig.classList.contains("open");
    rig.classList.toggle("open", open);
    rigBar.setAttribute("aria-expanded", open ? "true" : "false");
  });

  window.addEventListener("hashchange", go);
  go();

  /* offline support (sw.js); service workers need HTTPS or localhost */
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }
})();

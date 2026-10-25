/* 7uner – page switching (#tuner, #learn), the Learn instrument picker
   and the Learn sections (level test, song studies) */
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

  /* Learn: sections */
  const SECTIONS = ["test", "songs"];
  let section = "test";
  try { const v = sessionStorage.getItem("7uner.learnSection"); if (SECTIONS.includes(v)) section = v; } catch (e) {}

  function pauseLearn(except) {
    if (except !== "test" && window.levelTest) window.levelTest.pause();
    if (except !== "songs" && window.songStudies) window.songStudies.pause();
    if (except !== "songs" && window.customTabs) window.customTabs.pause();
  }

  function setSection(sec) {
    section = sec;
    try { sessionStorage.setItem("7uner.learnSection", sec); } catch (e) {}
    SECTIONS.forEach((k) => { document.getElementById("sec-" + k).hidden = k !== sec; });
    document.querySelectorAll("#learnNav button").forEach((b) => b.setAttribute("aria-selected", b.dataset.sec === sec ? "true" : "false"));
    pauseLearn(sec);
    if (sec === "songs" && window.songStudies) window.songStudies.refresh();
  }
  document.querySelectorAll("#learnNav button").forEach((b) => b.addEventListener("click", () => setSection(b.dataset.sec)));

  function go() {
    let p = (location.hash || "").slice(1);
    if (!pages[p]) p = "tuner";
    Object.keys(pages).forEach((k) => { document.getElementById(pages[k]).hidden = k !== p; });
    document.querySelectorAll(".sitenav a").forEach((a) => {
      if (a.dataset.page === p) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (p !== "tuner" && window.tuner && window.tuner.isRunning()) window.tuner.stop();
    if (p !== "learn") pauseLearn(null);
    if (p === "tuner" && window.tuner) window.tuner.resize();
    if (p === "learn") setSection(section);
    document.title = p === "learn" ? "Learn – 7uner" : "7uner";
  }

  window.addEventListener("hashchange", go);
  go();
})();
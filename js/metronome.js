/* 7uner – metronome
   A wooden pyramid metronome beside the amp. While Practice or Tab Studio
   plays, the rod swings at the playing tempo, reaching one side on every
   beat; it free-runs at the tempo and is pulled into phase by alphaTab's
   play position. Sliding the weight sets the tempo (higher is slower, as on
   the real thing), and the − and + buttons beside the readout move it by
   10 BPM. On the sides, a brass knob sets the click volume and a brass
   switch turns the one-bar count-in on or off.

   The open page binds itself as the source:
     metronome.bind({ bpm(), setBpm(v), range: [min, max], playing() })
     metronome.sync(source, tick)   on alphaTab's playerPositionChanged
     metronome.level()              click volume for alphaTab, 0 to 2.5
     metronome.countIn()            whether to count in a bar before playing
   and listens for the "metronomechange" event on window. */
(function () {
    "use strict";

    // v2: the click got twice as loud and starts with the knob in the middle;
    // v3: the count-in starts off (a v2 setting keeps only its volume)
    const KEY = "7uner.metronome.v3";
    const st = { volume: 5, countIn: false };
    try {
        const o = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem("7uner.metronome.v2") || "null");
        if (o && o.volume >= 0 && o.volume <= 10) st.volume = +o.volume;
        if (o && localStorage.getItem(KEY) && typeof o.countIn === "boolean") st.countIn = o.countIn;
    } catch (e) {}
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
    // alphaTab's click (a short tick) is easily buried under the guitar, so
    // the knob goes well past alphaTab's default of 1: 5 is 1.25, 10 is 2.5
    const level = () => st.volume * 0.25;
    const countIn = () => st.countIn;
    const changed = () => window.dispatchEvent(new Event("metronomechange"));

    /* ---------- drawing ----------
       viewBox 160×270. The rod pivots at (80,196); the weight's centre runs
       from y=48 (30 BPM) to y=176 (300 BPM) on a log scale, like the
       markings on a real one. */
    const PIVOT = [80, 196], SWING = 24;
    const MIN = 30, MAX = 300, TOP = 48, SPAN = 128;
    const yOf = (b) => TOP + (SPAN * Math.log(b / MIN)) / Math.log(MAX / MIN);
    const bpmOf = (y) => MIN * Math.pow(MAX / MIN, (y - TOP) / SPAN);

    const MARKS = [40, 60, 80, 100, 120, 160, 200, 240];
    const scale = MARKS.map((b) => {
        const y = yOf(b).toFixed(1);
        return '<path d="M83 ' + y + 'h5"/><text x="90" y="' + (+y + 2.3) + '">' + b + "</text>";
    }).join("");

    const SVG =
        '<svg viewBox="0 0 160 270" class="metro-svg">' +
        "<defs>" +
        '<linearGradient id="mWood" x1="0" x2="1"><stop offset="0" stop-color="#4A2512"/><stop offset=".5" stop-color="#8A4E28"/><stop offset="1" stop-color="#4A2512"/></linearGradient>' +
        '<linearGradient id="mBase" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A2614"/><stop offset="1" stop-color="#26130A"/></linearGradient>' +
        '<linearGradient id="mBrass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7E08A"/><stop offset=".55" stop-color="#D4AF37"/><stop offset="1" stop-color="#8E6A1A"/></linearGradient>' +
        '<linearGradient id="mPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3EBD8"/><stop offset="1" stop-color="#DCCFB2"/></linearGradient>' +
        "</defs>" +
        // body, scale plate and markings
        '<path d="M61 10H99Q101 10 102 13L142 228H18L58 13Q59 10 61 10Z" fill="url(#mWood)" stroke="#2A1408" stroke-width="1.5"/>' +
        '<path d="M68 28H92L118 204H42Z" fill="url(#mPlate)" stroke="#3A1E0E" stroke-width="1"/>' +
        '<g class="metro-scale" stroke="#5A3A1E" stroke-width=".8" fill="#4A2E16">' + scale + "</g>" +
        // volume knob on the side, where a winding key sits on a real one
        '<g class="metro-vol" role="slider" tabindex="0" aria-label="Metronome volume" aria-valuemin="0" aria-valuemax="10">' +
        '<title>Metronome volume: drag up or down, scroll, or use the arrow keys</title>' +
        '<circle cx="145" cy="150" r="18" fill="transparent"/>' +
        '<rect x="124" y="147" width="12" height="6" rx="1" fill="#8E6A1A"/>' +
        '<g class="metro-volcap"><circle cx="145" cy="150" r="11" fill="url(#mBrass)" stroke="#5C4210" stroke-width="1.2"/>' +
        '<circle cx="145" cy="150" r="7.5" fill="none" stroke="#8E6A1A" stroke-width=".8" stroke-dasharray="1.2 1.4"/>' +
        '<path d="M145 150V140.5" stroke="#2A1C05" stroke-width="2.2" stroke-linecap="round"/></g>' +
        '<text class="metro-vollab" x="145" y="174" text-anchor="middle">VOL</text>' +
        "</g>" +
        // count-in switch on the other side: a toggle bat, up is on
        '<g class="metro-cnt" role="switch" tabindex="0" aria-label="Count-in">' +
        "<title>Count-in: one bar of clicks before playing</title>" +
        '<circle cx="15" cy="150" r="18" fill="transparent"/>' +
        '<rect x="24" y="147" width="12" height="6" rx="1" fill="#8E6A1A"/>' +
        '<circle cx="15" cy="150" r="9" fill="url(#mBrass)" stroke="#5C4210" stroke-width="1.2"/>' +
        '<circle cx="15" cy="150" r="4.5" fill="#2A1C05"/>' +
        '<g class="metro-bat"><path d="M13.2 150L13.9 137.5Q15 135.2 16.1 137.5L16.8 150Z" fill="#E6E8EB" stroke="#5E646C" stroke-width=".8"/>' +
        '<circle cx="15" cy="136.5" r="2.7" fill="#F4F5F7" stroke="#5E646C" stroke-width=".8"/></g>' +
        '<text class="metro-vollab metro-cntlab" x="15" y="174" text-anchor="middle">COUNT</text>' +
        "</g>" +
        // rod and sliding weight
        '<g class="metro-rod">' +
        '<path d="M80 196V20" stroke="#B9BEC5" stroke-width="2.4" stroke-linecap="round"/>' +
        '<g class="metro-weight" role="slider" tabindex="0" aria-label="Tempo" aria-valuemin="' + MIN + '" aria-valuemax="' + MAX + '">' +
        "<title>Tempo: slide the weight, scroll, or use the arrow keys</title>" +
        '<rect x="-20" y="-16" width="40" height="32" fill="transparent"/>' +
        '<path d="M-10 -9H10L13 9H-13Z" fill="url(#mBrass)" stroke="#5C4210" stroke-width="1.2" stroke-linejoin="round"/>' +
        '<path d="M-8 -3H8" stroke="#8E6A1A" stroke-width="1"/><circle cx="0" cy="3.5" r="1.8" fill="#5C4210"/>' +
        "</g></g>" +
        '<circle cx="80" cy="196" r="5" fill="url(#mBrass)" stroke="#5C4210" stroke-width="1"/>' +
        // base with the tempo readout
        '<rect x="10" y="226" width="140" height="38" rx="6" fill="url(#mBase)" stroke="#1A0C05" stroke-width="1.5"/>' +
        '<rect x="44" y="234" width="72" height="22" rx="3" fill="#120A05" stroke="#5C4210" stroke-width="1"/>' +
        '<text class="metro-bpm" x="98" y="251" text-anchor="end">–</text>' +
        '<text class="metro-unit" x="101" y="251">BPM</text>' +
        step(-10, 15, "M22 245H32") + step(10, 121, "M128 245H138M133 240V250") +
        "</svg>";

    // a brass button on the base, beside the readout, that moves the tempo by d
    function step(d, x, glyph) {
        return '<g class="metro-step" data-d="' + d + '" role="button" tabindex="0" aria-label="' + (d < 0 ? "Slower" : "Faster") + " by " + Math.abs(d) + ' BPM">' +
            '<rect x="' + (x - 4) + '" y="228" width="32" height="34" fill="transparent"/>' + // a bigger target for fingers
            '<rect x="' + x + '" y="234" width="24" height="22" rx="4" fill="url(#mBrass)" stroke="#5C4210" stroke-width="1"/>' +
            '<path d="' + glyph + '" stroke="#2A1C05" stroke-width="2.4" stroke-linecap="round"/></g>';
    }

    const root = document.getElementById("metro");
    if (!root) { window.metronome = { bind() {}, sync() {}, level, countIn }; return; }
    root.innerHTML = SVG;
    const svg = root.querySelector("svg"), rod = root.querySelector(".metro-rod"), weight = root.querySelector(".metro-weight");
    const readout = root.querySelector(".metro-bpm"), vol = root.querySelector(".metro-vol"), volcap = root.querySelector(".metro-volcap");

    /* ---------- state ---------- */
    let src = null, beat = 0, angle = 0, was = false, last = 0, shownBpm = null, offSince = 0;
    const bpmNow = () => (src ? src.bpm() : null);

    function setWeight(b) {
        const y = yOf(Math.max(MIN, Math.min(MAX, b || 100)));
        weight.setAttribute("transform", "translate(80 " + y.toFixed(2) + ")");
    }
    function showBpm() {
        const b = bpmNow();
        if (b === shownBpm) return;
        shownBpm = b;
        readout.textContent = b ? Math.round(b) : "–";
        if (b) { setWeight(b); weight.setAttribute("aria-valuenow", Math.round(b)); }
        root.classList.toggle("idle", !b);
    }

    function frame(now) {
        requestAnimationFrame(frame);
        const dt = Math.min(100, now - (last || now));
        last = now;
        if (root.offsetParent === null) return; // not on screen
        showBpm();
        const on = !!(src && src.playing() && bpmNow());
        // started: the rod begins at one side. alphaTab reports a brief stop
        // when the count-in ends, which mustn't restart the swing.
        if (on && !was && now - offSince > 250) beat = 0;
        if (!on && was) offSince = now;
        was = on;
        if (on) {
            beat += (dt * bpmNow()) / 60000;
            angle = SWING * Math.cos(Math.PI * beat);
        } else {
            angle += (0 - angle) * Math.min(1, dt / 120); // settle back to the middle
        }
        rod.setAttribute("transform", "rotate(" + angle.toFixed(2) + " " + PIVOT[0] + " " + PIVOT[1] + ")");
    }
    requestAnimationFrame(frame);

    /* keep the swing in phase with the music: a quarter note is 960 ticks.
       Only the fraction of a beat is corrected, so a loop jumping back doesn't
       jerk the rod, and only part of the error each time, so it eases into
       phase instead of snapping (e.g. when the count-in ends). */
    function sync(s, tick) {
        if (s !== src || !was) return;
        const tb = tick / 960;
        beat += (tb + Math.round(beat - tb) - beat) * 0.2;
    }

    function bind(s) { src = s; shownBpm = undefined; was = false; showBpm(); }

    /* ---------- tempo: slide the weight ---------- */
    const range = () => (src && src.range) || [MIN, MAX];
    const setBpm = (b) => {
        if (!src || !bpmNow()) return;
        const [lo, hi] = range();
        src.setBpm(Math.round(Math.max(lo, Math.min(hi, b))));
        showBpm();
    };
    const svgY = (clientY) => { const r = svg.getBoundingClientRect(); return ((clientY - r.top) * 270) / r.height; };
    let grab = null;
    weight.addEventListener("pointerdown", (e) => {
        if (!bpmNow()) return;
        weight.setPointerCapture(e.pointerId);
        grab = svgY(e.clientY) - yOf(bpmNow());
        root.classList.add("sliding");
    });
    weight.addEventListener("pointermove", (e) => {
        if (grab === null || !weight.hasPointerCapture(e.pointerId)) return;
        setBpm(bpmOf(Math.max(TOP, Math.min(TOP + SPAN, svgY(e.clientY) - grab))));
    });
    const drop = () => { grab = null; root.classList.remove("sliding"); };
    weight.addEventListener("pointerup", drop);
    weight.addEventListener("pointercancel", drop);
    weight.addEventListener("wheel", (e) => { if (!bpmNow()) return; e.preventDefault(); setBpm(bpmNow() + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
    weight.addEventListener("keydown", (e) => {
        const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
        if (d === undefined || !bpmNow()) return;
        e.preventDefault(); setBpm(bpmNow() + d);
    });

    root.querySelectorAll(".metro-step").forEach((b) => {
        const go = () => { if (bpmNow()) setBpm(bpmNow() + +b.dataset.d); };
        b.addEventListener("click", go);
        b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });

    /* ---------- click volume: the brass knob, 0 to 10 ---------- */
    function setVol(v) {
        st.volume = Math.round(Math.max(0, Math.min(10, v)) * 10) / 10;
        volcap.setAttribute("transform", "rotate(" + ((st.volume / 10) * 270 - 135).toFixed(1) + " 145 150)");
        vol.setAttribute("aria-valuenow", st.volume);
        vol.setAttribute("aria-valuetext", st.volume.toFixed(1));
        changed();
    }
    setVol(st.volume);
    let v0 = 0, y0 = 0;
    vol.addEventListener("pointerdown", (e) => { vol.setPointerCapture(e.pointerId); y0 = e.clientY; v0 = st.volume; root.classList.add("turning"); });
    vol.addEventListener("pointermove", (e) => { if (vol.hasPointerCapture(e.pointerId)) setVol(v0 + (y0 - e.clientY) / 15); });
    const end = () => { root.classList.remove("turning"); save(); };
    vol.addEventListener("pointerup", end);
    vol.addEventListener("pointercancel", end);
    vol.addEventListener("wheel", (e) => { e.preventDefault(); setVol(st.volume + (e.deltaY < 0 ? 0.5 : -0.5)); save(); }, { passive: false });
    vol.addEventListener("keydown", (e) => {
        const d = { ArrowUp: 0.5, ArrowRight: 0.5, ArrowDown: -0.5, ArrowLeft: -0.5, PageUp: 2, PageDown: -2 }[e.key];
        if (e.key === "Home" || e.key === "End") { e.preventDefault(); setVol(e.key === "Home" ? 0 : 10); save(); return; }
        if (d === undefined) return;
        e.preventDefault(); setVol(st.volume + d); save();
    });

    /* ---------- count-in: the switch, on by default ---------- */
    const cnt = root.querySelector(".metro-cnt");
    function showCount() {
        cnt.setAttribute("aria-checked", st.countIn ? "true" : "false");
        root.classList.toggle("counting", st.countIn);
    }
    const flip = () => { st.countIn = !st.countIn; save(); showCount(); changed(); };
    cnt.addEventListener("click", flip);
    cnt.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
    showCount();

    window.metronome = { bind, sync, level, countIn };
})();

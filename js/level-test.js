/* 7uner – guitar level test */
(function () {
    "use strict";

    const OPEN = [64, 59, 55, 50, 45, 40];
    const SN = ["e", "B", "G", "D", "A", "E"];
    const SI = { e: 0, B: 1, G: 2, D: 3, A: 4, E: 5 };
    const TECH = { h: "h", p: "p", m: "PM" };
    const LV = ["Beginner", "Elementary", "Intermediate", "Upper-intermediate", "Advanced"];

    function P(str) {
        return str.trim().split(/\s+/).map((t) => {
            const m = t.match(/^([eBGDAE])(\d+)([hpm])?$/);
            return { s: SI[m[1]], f: +m[2], t: m[3] || "" };
        });
    }
    function updown(s) { const a = P(s); return a.concat(a.slice().reverse()); }

    const chUp = [], chDn = [];
    ["E", "A", "D", "G", "B", "e"].forEach((s) => [1, 2, 3, 4].forEach((f) => chUp.push(s + f)));
    ["e", "B", "G", "D", "A", "E"].forEach((s) => [4, 3, 2, 1].forEach((f) => chDn.push(s + f)));

    const EX = [
        { id: "chrom", cat: "tech", name: "Alternate picking – chromatic", sub: 4, step: 8, th: [70, 90, 110, 130],
            desc: "Sixteenth notes, changing pick direction on every note (down-up). One finger per fret, 1-2-3-4. The rhythm shouldn’t slip when you cross strings.",
            notes: P(chUp.concat(chDn).join(" ")) },
        { id: "trem", cat: "trem", name: "Tremolo and palm muting", sub: 4, step: 10, th: [90, 120, 150, 180],
            desc: "Continuous down-up sixteenths on the low E string with palm muting (PM). Measures picking-hand consistency and stamina; play from the wrist with small motions.",
            notes: P("E0m E0m E0m E0m E0m E0m E0m E0m E1m E1m E1m E1m E0m E0m E0m E0m E0m E0m E0m E0m E3m E3m E3m E3m E2m E2m E2m E2m E1m E1m E1m E1m") },
        { id: "pent", cat: "scale", name: "A minor pentatonic – box 1", sub: 4, step: 8, th: [80, 100, 120, 140],
            desc: "The classic box at the 5th fret, up and down in sixteenths. Alternate picking.",
            notes: updown("E5 E8 A5 A7 D5 D7 G5 G7 B5 B8 e5 e8") },
        { id: "nps", cat: "scale", name: "A natural minor – three notes per string", sub: 6, step: 6, th: [60, 80, 100, 120],
            desc: "Sextuplets: six notes per beat, so one string per beat. This is the foundation of fast solo runs.",
            notes: updown("E5 E7 E8 A5 A7 A8 D5 D7 D9 G5 G7 G9 B6 B8 B10 e7 e8 e10") },
        { id: "leg", cat: "legato", name: "Legato – hammer-ons and pull-offs", sub: 4, step: 8, th: [80, 100, 125, 150],
            desc: "Pick only the unmarked notes. h = hammer-on, p = pull-off. Measures whether your fretting hand can sound notes clearly on its own.",
            notes: P("e5 e7h e8h e7p e5 e7h e8h e7p B5 B6h B8h B6p B5 B6h B8h B6p G4 G5h G7h G5p G4 G5h G7h G5p D5 D7h D9h D7p D5 D7h D9h D7p") },
        { id: "arp", cat: "arp", name: "Arpeggios – Am F G E", sub: 6, step: 6, th: [50, 70, 90, 110],
            desc: "Three-string arpeggios in sextuplets. Sweep the pick across the strings in one motion or alternate pick; keep the notes from bleeding into each other.",
            notes: P("G14 B13 e12 e17 e12 B13 G10 B10 e8 e13 e8 B10 G12 B12 e10 e15 e10 B12 G9 B9 e7 e12 e7 B9") }
    ];
    EX.forEach((e) => { e.start = e.th[0] - e.step; });

    const MEL = [P("E5 E8 A5 A7"), P("A7 A5 E8 E5"), P("D7 D5 A7 A5"), P("G5 D7 D5 D7 A7"), P("B5 G7 G5 D7 G5 G7")];
    const IV = [["Minor 2nd", 1], ["Major 2nd", 2], ["Minor 3rd", 3], ["Major 3rd", 4], ["Perfect 4th", 5], ["Tritone", 6], ["Perfect 5th", 7], ["Octave", 12]];
    const CHECKS = [
        "I know all five positions of A minor pentatonic and can move between them",
        "I can play over a backing track for a full minute without stopping or getting stuck in the same pattern",
        "When the chords change (e.g. Am – F – G), I can aim for the notes of each chord",
        "I can hear and use the difference between natural minor and Dorian or Phrygian",
        "I can figure out a simple riff by ear within five minutes",
        "My bends reach the correct pitch (I’ve checked with a tuner)",
        "My vibrato is controlled and even, and I can change its speed at will"
    ];

    /* ---------- state ---------- */
    const KEY = "7uner.levelTest.v1";
    const fresh = (history) => ({ ex: {}, interval: null, melody: { pts: [] }, improv: { checked: CHECKS.map(() => false), done: false }, history: history || [] });
    let S = fresh();
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
            S = Object.assign(S, JSON.parse(raw));
            if (!S.melody || !Array.isArray(S.melody.pts)) S.melody = { pts: [] };
        }
    } catch (e) {}
    function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
    function exRec(id) { return S.ex[id] || (S.ex[id] = { best: 0, done: false }); }

    /* ---------- audio ---------- */
    let ctx, master;
    function ac() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
        }
        if (ctx.state === "suspended") ctx.resume();
        return ctx;
    }
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    function click(t, acc) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "square"; o.frequency.value = acc ? 1700 : 1050;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(acc ? 0.3 : 0.17, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        o.connect(g).connect(master); o.start(t); o.stop(t + 0.05);
    }
    function pluck(midi, t, dur, muted) {
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = "sawtooth"; o.frequency.value = mtof(midi);
        f.type = "lowpass";
        f.frequency.setValueAtTime(muted ? 850 : 3200, t);
        f.frequency.exponentialRampToValueAtTime(muted ? 280 : 650, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(muted ? 0.2 : 0.14, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
    }
    function tone(midi, t, dur) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "triangle"; o.frequency.value = mtof(midi);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
        g.gain.setValueAtTime(0.3, t + dur * 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
    }
    const midiOf = (n) => OPEN[n.s] + n.f;

    /* ---------- tab rendering ---------- */
    function renderTab(el, notes, sub, perLine) {
        el.innerHTML = "";
        const cols = [];
        for (let st = 0; st < notes.length; st += perLine) {
            const seg = notes.slice(st, st + perLine), line = document.createElement("div");
            line.className = "tabline";
            line.style.gridTemplateColumns = "1.6em repeat(" + seg.length + ", var(--cw))";
            for (let r = 0; r < 6; r++) {
                const lab = document.createElement("div");
                lab.className = "sl"; lab.textContent = SN[r]; line.appendChild(lab);
                seg.forEach((n, k) => {
                    const c = st + k, cell = document.createElement("div");
                    cell.className = "cell" + (c % sub === 0 ? " beat" : "");
                    if (n.s === r) {
                        const sp = document.createElement("span");
                        sp.className = "fn"; sp.textContent = n.f; cell.appendChild(sp);
                        if (n.t) { const i = document.createElement("i"); i.textContent = TECH[n.t]; cell.appendChild(i); }
                    }
                    (cols[c] = cols[c] || []).push(cell);
                    line.appendChild(cell);
                });
            }
            el.appendChild(line);
        }
        return cols;
    }

    /* ---------- view switching ---------- */
    const $ = (id) => document.getElementById(id);
    const views = ["speed", "ear", "improv", "result"];
    function show(v) {
        if (!views.includes(v)) v = "speed";
        document.querySelectorAll("#page-test .tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.view === v ? "true" : "false"));
        views.forEach((x) => { $("v-" + x).hidden = x !== v; });
        if (v !== "speed" && playing) finish(false);
        if (v === "result") renderResult();
    }
    document.querySelectorAll("#page-test .tabs button").forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));

    /* ---------- speed tests ---------- */
    const bpmEl = $("bpm"), goBtn = $("go"), msg = $("msg"), rate = $("rate"), countin = $("countin");
    let cur = 0, cols = [], playing = false, timer = null, raf = null, nextTime = 0, step = 0, total = 0,
        countSteps = 0, spd = 0, vq = [], lastCol = -1, startT = 0, playBpm = 0, endAt = 0;

    function exLevel(ex) {
        const r = S.ex[ex.id];
        if (!r || !r.done) return null;
        let l = 1;
        ex.th.forEach((t) => { if (r.best >= t) l++; });
        return Math.min(l, 5);
    }

    function renderList() {
        const ol = $("exlist");
        ol.innerHTML = "";
        EX.forEach((ex, i) => {
            const li = document.createElement("li"), b = document.createElement("button");
            const r = S.ex[ex.id], lv = exLevel(ex);
            let st = "Not tried yet", cls = "st";
            if (lv) { st = (r.best ? r.best + " BPM, " : "") + LV[lv - 1]; cls += " done"; }
            else if (r && r.best) { st = "So far " + r.best + " BPM"; }
            b.innerHTML = '<span class="no">' + (i + 1) + '</span><span class="nm"></span><span class="' + cls + '"></span>';
            b.querySelector(".nm").textContent = ex.name;
            b.querySelector(".st").textContent = st;
            if (i === cur) b.setAttribute("aria-current", "true");
            b.addEventListener("click", () => select(i));
            li.appendChild(b); ol.appendChild(li);
        });
    }

    function select(i) {
        if (playing) finish(false);
        cur = i;
        const ex = EX[i], r = S.ex[ex.id];
        $("exTitle").textContent = ex.name;
        $("exDesc").textContent = ex.desc;
        bpmEl.value = r && r.best ? (r.done ? r.best : r.best + ex.step) : ex.start;
        cols = renderTab($("tabwrap"), ex.notes, ex.sub, ex.sub * 4);
        rate.hidden = true;
        msg.textContent = r && r.done
            ? "Test complete: " + (r.best ? r.best + " BPM" : "below the starting tempo") + ". Try again at a higher tempo if you like."
            : "";
        renderList();
    }

    function clampBpm() {
        let v = Math.round(+bpmEl.value || 60);
        v = Math.max(30, Math.min(300, v));
        bpmEl.value = v;
        return v;
    }
    $("bpmDown").onclick = () => { bpmEl.value = clampBpm() - 2; clampBpm(); };
    $("bpmUp").onclick = () => { bpmEl.value = clampBpm() + 2; clampBpm(); };
    bpmEl.addEventListener("change", clampBpm);

    function setCol(c) {
        if (lastCol >= 0 && cols[lastCol]) cols[lastCol].forEach((x) => x.classList.remove("on"));
        if (c >= 0 && cols[c]) {
            cols[c].forEach((x) => x.classList.add("on"));
            const w = $("tabwrap"), cl = cols[c][0].getBoundingClientRect(), wr = w.getBoundingClientRect();
            if (cl.right > wr.right - 20 || cl.left < wr.left + 20) w.scrollLeft += cl.left - wr.left - wr.width / 3;
        }
        lastCol = c;
    }

    function start() {
        ac();
        const ex = EX[cur];
        playBpm = clampBpm();
        countSteps = 4 * ex.sub;
        total = countSteps + ex.notes.length * +$("loops").value;
        spd = 60 / playBpm / ex.sub;
        step = 0; vq = [];
        startT = nextTime = ctx.currentTime + 0.12;
        endAt = Infinity;
        playing = true;
        goBtn.textContent = "Stop"; goBtn.classList.add("stop");
        rate.hidden = true; msg.textContent = "";
        sched();
        timer = setInterval(sched, 25);
        raf = requestAnimationFrame(draw);
    }

    function sched() {
        const ex = EX[cur];
        while (nextTime < ctx.currentTime + 0.12 && step < total) {
            schedStep(step, nextTime, ex);
            nextTime += spd; step++;
        }
        if (step >= total && timer) { clearInterval(timer); timer = null; endAt = nextTime; }
    }

    function schedStep(i, t, ex) {
        if (i < countSteps) {
            if (i % ex.sub === 0) { click(t, i === 0); vq.push({ t, count: 4 - i / ex.sub }); }
            return;
        }
        const j = (i - countSteps) % ex.notes.length, n = ex.notes[j];
        if (j % ex.sub === 0 && $("clickOn").checked) click(t, j === 0);
        if ($("playNotes").checked) pluck(midiOf(n), t, n.t === "m" ? 0.11 : Math.min(0.5, spd * 2.4), n.t === "m");
        vq.push({ t, col: j });
    }

    function draw() {
        const now = ctx.currentTime;
        while (vq.length && vq[0].t <= now) {
            const e = vq.shift();
            if (e.count != null) { countin.textContent = e.count; countin.classList.add("show"); }
            else { countin.classList.remove("show"); setCol(e.col); }
        }
        if (playing && now >= endAt) { finish(true); return; }
        raf = requestAnimationFrame(draw);
    }

    function finish(natural) {
        const ex = EX[cur], now = ctx ? ctx.currentTime : 0;
        playing = false;
        if (timer) { clearInterval(timer); timer = null; }
        if (raf) cancelAnimationFrame(raf);
        vq = []; setCol(-1);
        countin.classList.remove("show");
        goBtn.textContent = "Start"; goBtn.classList.remove("stop");
        const played = (now - startT) / spd - countSteps;
        if (natural || played >= ex.notes.length) {
            $("rateQ").textContent = "How did " + playBpm + " BPM feel?";
            rate.hidden = false;
        } else {
            msg.textContent = "Stopped before a full pass. Play at least one complete pass to rate it.";
        }
    }

    goBtn.onclick = () => { playing ? finish(false) : start(); };
    document.addEventListener("keydown", (e) => {
        if (e.code !== "Space" || $("page-test").hidden || $("v-speed").hidden) return;
        if (["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(e.target.tagName)) return;
        e.preventDefault();
        playing ? finish(false) : start();
    });

    rate.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
        const ex = EX[cur], r = exRec(ex.id), k = b.dataset.r;
        rate.hidden = true;
        if (k === "ok") {
            r.best = Math.max(r.best, playBpm); r.done = true;
            bpmEl.value = playBpm + ex.step;
            msg.textContent = playBpm + " BPM saved (" + LV[exLevel(ex) - 1] + "). Now try " + (playBpm + ex.step) + " BPM; stop when it gets hard.";
        } else if (r.best > 0) {
            r.done = true;
            msg.textContent = "That’s your limit. Result: " + r.best + " BPM, " + LV[exLevel(ex) - 1] + " level. You can move on to the next test.";
        } else {
            const nb = Math.max(30, playBpm - ex.step * (k === "fail" ? 2 : 1));
            bpmEl.value = nb;
            if (playBpm <= ex.start - ex.step * 2 || nb === 30) {
                r.done = true;
                msg.textContent = "This exercise is at beginner level for now. That’s fine; the Results tab shows how to work on it.";
            } else {
                msg.textContent = "Tempo lowered to " + nb + " BPM. Let’s find where you’re comfortable.";
            }
        }
        save(); renderList();
    }));
    $("nextEx").onclick = () => { if (cur < EX.length - 1) select(cur + 1); else show("ear"); };
    $("resetEx").onclick = () => { delete S.ex[EX[cur].id]; save(); select(cur); };

    /* ---------- interval quiz ---------- */
    const Q = { i: 0, score: 0, cur: null, answered: true, active: false };
    function qRender() {
        $("qnum").textContent = Q.active ? "Question " + (Q.i + 1) + " / 10" : "Question –";
        $("qscore").textContent = Q.active || S.interval
            ? "Correct: " + (Q.active ? Q.score : S.interval.score) + (Q.active ? "" : " / 10")
            : "";
    }
    function qPlay() {
        if (!Q.cur) return;
        ac();
        const t = ctx.currentTime + 0.05;
        tone(Q.cur.root, t, 0.75);
        tone(Q.cur.root + Q.cur.semis, t + 0.85, 0.95);
    }
    function qNew() {
        Q.cur = { root: 48 + Math.floor(Math.random() * 12), semis: IV[Math.floor(Math.random() * IV.length)][1] };
        Q.answered = false;
        const box = $("qopts");
        box.innerHTML = "";
        IV.forEach((iv, k) => {
            const b = document.createElement("button");
            b.className = "btn"; b.textContent = iv[0];
            b.onclick = () => qAnswer(k, b);
            box.appendChild(b);
        });
        $("qfb").textContent = "";
        $("qnext").hidden = true;
        qRender(); qPlay();
    }
    function qAnswer(k, btn) {
        if (Q.answered) return;
        Q.answered = true;
        const ok = IV[k][1] === Q.cur.semis;
        if (ok) Q.score++;
        $("qopts").querySelectorAll("button").forEach((b, i) => {
            b.disabled = true;
            if (IV[i][1] === Q.cur.semis) b.classList.add("right");
        });
        if (!ok) btn.classList.add("wrong");
        $("qfb").textContent = ok ? "Correct." : "The answer was: " + IV.find((x) => x[1] === Q.cur.semis)[0] + ".";
        if (Q.i === 9) {
            Q.active = false;
            S.interval = { score: Q.score, total: 10 };
            save();
            $("qfb").textContent += " Test finished: " + Q.score + " / 10.";
            $("qplay").disabled = true;
        } else {
            $("qnext").hidden = false;
        }
        qRender();
    }
    $("qstart").onclick = () => {
        Q.i = 0; Q.score = 0; Q.active = true;
        $("qplay").disabled = false;
        $("qstart").textContent = "Start over";
        qNew();
    };
    $("qplay").onclick = qPlay;
    $("qnext").onclick = () => { Q.i++; qNew(); };

    /* ---------- play what you hear ---------- */
    let mi = 0, mshown = false;
    function mRender() {
        const done = S.melody.pts.length >= MEL.length;
        mi = Math.min(S.melody.pts.length, MEL.length - 1);
        $("mnum").textContent = done ? "Complete" : "Phrase " + (mi + 1) + " / " + MEL.length;
        const sum = S.melody.pts.reduce((a, b) => a + b, 0);
        $("mscore").textContent = S.melody.pts.length ? "Score: " + sum + " / " + (S.melody.pts.length * 2) : "";
        $("mtab").innerHTML = ""; mshown = false;
        $("mrate").hidden = true;
        ["mplay", "mshow"].forEach((id) => { $(id).disabled = done; });
        if (done) $("mfb").textContent = "Section finished. See it on the Results tab.";
    }
    $("mref").onclick = () => { ac(); pluck(45, ctx.currentTime + 0.05, 1.6, false); };
    $("mplay").onclick = () => {
        ac();
        const t = ctx.currentTime + 0.08;
        MEL[mi].forEach((n, k) => pluck(midiOf(n), t + k * 0.36, 0.5, false));
    };
    $("mshow").onclick = () => {
        if (mshown) return;
        mshown = true;
        renderTab($("mtab"), MEL[mi], 1, MEL[mi].length);
        $("mrate").hidden = false;
        $("mfb").textContent = "";
    };
    $("mrate").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
        S.melody.pts.push(+b.dataset.m); save(); mRender();
    }));
    $("mreset").onclick = () => { S.melody = { pts: [] }; save(); $("mfb").textContent = ""; mRender(); };

    /* ---------- improvisation ---------- */
    const ul = $("checks");
    CHECKS.forEach((c, i) => {
        const li = document.createElement("li");
        li.innerHTML = '<label><input type="checkbox"><span></span></label>';
        li.querySelector("span").textContent = c;
        const cb = li.querySelector("input");
        cb.checked = !!S.improv.checked[i];
        cb.onchange = () => { S.improv.checked[i] = cb.checked; save(); };
        ul.appendChild(li);
    });
    $("saveImprov").onclick = () => {
        S.improv.done = true; save();
        $("ifb").textContent = "Saved: " + S.improv.checked.filter(Boolean).length + " / " + CHECKS.length + ".";
    };

    let drone = null, dInt = null;
    function stopDrone() {
        if (drone) {
            const t = ctx.currentTime;
            drone.g.gain.cancelScheduledValues(t);
            drone.g.gain.setTargetAtTime(0.0001, t, 0.15);
            drone.o.forEach((o) => o.stop(t + 0.8));
            drone = null;
        }
        if (dInt) { clearInterval(dInt); dInt = null; }
        $("drone").textContent = "Start the drone";
        $("dtimer").textContent = "1:00";
    }
    $("drone").onclick = () => {
        if (drone) { stopDrone(); return; }
        ac();
        const t = ctx.currentTime, g = ctx.createGain(), f = ctx.createBiquadFilter();
        f.type = "lowpass"; f.frequency.value = 650;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09, t + 0.6);
        f.connect(g).connect(master);
        const o = [33, 45, 52].map((m, k) => {
            const x = ctx.createOscillator();
            x.type = "sawtooth"; x.frequency.value = mtof(m); x.detune.value = k * 4 - 4;
            x.connect(f); x.start(t);
            return x;
        });
        drone = { g, o };
        $("drone").textContent = "Stop the drone";
        const t0 = Date.now();
        dInt = setInterval(() => {
            const left = Math.max(0, 60 - Math.floor((Date.now() - t0) / 1000));
            $("dtimer").textContent = "0:" + String(left).padStart(2, "0");
            if (left === 0) { clearInterval(dInt); dInt = null; $("dtimer").textContent = "Time’s up"; }
        }, 250);
    };

    /* ---------- results ---------- */
    function lvFromScore(v, cuts) { let l = 1; cuts.forEach((c) => { if (v >= c) l++; }); return l; }
    function cats() {
        const g = (id) => EX.find((e) => e.id === id);
        const bp = (id) => { const r = S.ex[id]; return r && r.done ? (r.best ? r.best + " BPM" : "below starting tempo") : ""; };
        const sc = [exLevel(g("pent")), exLevel(g("nps"))].filter((x) => x);
        const mp = S.melody.pts, mDone = mp.length >= MEL.length, mSum = mp.reduce((a, b) => a + b, 0);
        const nChk = S.improv.checked.filter(Boolean).length;
        return [
            { k: "tech", n: "Alternate picking speed", l: exLevel(g("chrom")), d: bp("chrom") },
            { k: "trem", n: "Picking hand: tremolo and palm muting", l: exLevel(g("trem")), d: bp("trem") },
            { k: "scale", n: "Scale knowledge and fluency", l: sc.length === 2 ? (sc[0] + sc[1]) / 2 : null, d: sc.length === 2 ? [bp("pent"), bp("nps")].join(", ") : "" },
            { k: "legato", n: "Fretting hand: legato", l: exLevel(g("leg")), d: bp("leg") },
            { k: "arp", n: "Arpeggios and string crossing", l: exLevel(g("arp")), d: bp("arp") },
            { k: "interval", n: "Interval recognition", l: S.interval ? lvFromScore(S.interval.score, [4, 6, 8, 10]) : null, d: S.interval ? S.interval.score + " / 10" : "" },
            { k: "melody", n: "Playing by ear", l: mDone ? lvFromScore(mSum, [3, 5, 7, 9]) : null, d: mDone ? mSum + " / 10" : "" },
            { k: "improv", n: "Improvisation and theory", l: S.improv.done ? lvFromScore(nChk, [2, 4, 5, 7]) : null, d: S.improv.done ? nChk + " / 7" : "" }
        ];
    }
    const REC = {
        tech: "Start the 1-2-3-4 chromatic exercise 10 BPM below your comfortable tempo. Five minutes a day, adding 4 BPM every two or three days. Keep your picking motion small and watch the difference between outside and inside picking when you cross strings; that’s the most common reason fast solos fall apart.",
        trem: "Do one-minute sets of non-stop tremolo picking from the wrist with small motions. Keep the palm-mute pressure constant; work on sixteenths first, then gallops and sextuplet patterns. Keep the metronome on.",
        scale: "Learn the five positions of A minor pentatonic in order and connect them, then play natural minor three notes per string. Play scales in sequences rather than straight up and down (groups of three and four): fast, busy solo lines are made of exactly that.",
        legato: "Spend some time playing with the fretting hand only, without the picking hand touching the strings. On pull-offs, pull the string slightly downward as you release it so the note doesn’t drop out.",
        arp: "Play Am – F – C – G arpeggios on three strings first, then across five. Go slowly until every note is separate; mute the strings you’re not playing with the free fingers of your fretting hand.",
        interval: "Spend ten minutes a day on intervals and link each one to the opening of a song you know. Play them on the guitar too: how many frets on the same string, and what shape on the neighbouring string.",
        melody: "The shortcut to playing by ear is singing first. Hum simple melodies you know (lullabies, jingles, the first four notes of a solo you love), find them on a single string, then move them into position.",
        improv: "Start improvising with constraints: one string, then only three notes, then two-bar question-and-answer phrases. Record yourself over a backing track and listen back. Work two or three licks you’ve memorised into different spots every day."
    };

    function renderResult() {
        const cs = cats(), have = cs.filter((c) => c.l != null);
        const box = $("cats");
        box.innerHTML = "";
        cs.forEach((c) => {
            const row = document.createElement("div");
            row.className = "cat";
            const filled = c.l != null ? Math.round(c.l) : 0;
            row.innerHTML = '<span class="cn"></span><span class="meter' + (c.l == null ? " empty" : "") + '">' +
                [1, 2, 3, 4, 5].map((i) => '<span class="' + (i <= filled ? "f" : "") + '"></span>').join("") +
                '</span><span class="cd"></span>';
            row.querySelector(".cn").textContent = c.n;
            row.querySelector(".cd").textContent = c.l != null ? LV[Math.round(c.l) - 1] + (c.d ? " (" + c.d + ")" : "") : "not done";
            box.appendChild(row);
        });
        if (!have.length) {
            $("ovBig").textContent = "No results yet";
            $("ovSub").textContent = "Start with the Technique and speed tab.";
            $("recs").innerHTML = "";
            renderHist();
            return;
        }
        const avg = have.reduce((a, c) => a + c.l, 0) / have.length;
        $("ovBig").textContent = LV[Math.round(avg) - 1];
        $("ovSub").textContent = avg.toFixed(1) + " / 5" + (have.length < cs.length ? ", " + (cs.length - have.length) + " section(s) missing" : "");
        const sorted = have.slice().sort((a, b) => a.l - b.l);
        const weak = sorted.filter((c) => c.l <= 3.5).slice(0, 3);
        const pick = weak.length ? weak : sorted.slice(0, 2);
        const rb = $("recs");
        rb.innerHTML = "";
        pick.forEach((c) => {
            const d = document.createElement("div");
            d.innerHTML = "<h3></h3><p></p>";
            d.querySelector("h3").textContent = c.n;
            d.querySelector("p").textContent = REC[c.k];
            rb.appendChild(d);
        });
        renderHist();
    }

    function renderHist() {
        const h = $("hist");
        h.innerHTML = "";
        S.history.slice().reverse().forEach((x) => {
            const li = document.createElement("li");
            li.textContent = x.d + "  " + x.o.toFixed(1) + " / 5  " + LV[Math.round(x.o) - 1];
            h.appendChild(li);
        });
    }
    $("saveHist").onclick = () => {
        const have = cats().filter((c) => c.l != null);
        if (!have.length) return;
        const avg = have.reduce((a, c) => a + c.l, 0) / have.length;
        S.history.push({ d: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }), o: avg });
        save(); renderHist();
    };
    $("resetAll").onclick = () => {
        if (!confirm("Delete all test results? Your history will be kept.")) return;
        S = fresh(S.history);
        save();
        ul.querySelectorAll("input").forEach((c) => { c.checked = false; });
        mRender(); qRender(); select(0); renderResult();
    };

    /* ---------- init ---------- */
    select(0); mRender(); qRender(); show("speed");
    window.levelTest = { pause() { if (playing) finish(false); stopDrone(); } };
})();
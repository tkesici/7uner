/* 7uner – amp
   One amp for everything alphaTab plays (Practice and Tab Studio): a drive
   knob (0 is clean, turning it up adds distortion) and a volume knob.

   alphaTab plays through a ScriptProcessorNode that it connects to its audio
   context's speakers. That connection is redirected into an amp chain built
   in the same context. Nothing else in 7uner uses a ScriptProcessorNode, so
   the tuner is untouched. The metronome is part of alphaTab's output, so it
   goes through the amp too.

   chain: in ─┬─────────────────────────────────────── clean ─┬─ volume ─ out
              └─ tight ─ pre-gain ─ clipper ─ mid ─ cab ─ drive ┘          */
(function () {
    "use strict";

    const KEY = "7uner.amp.v1";
    const st = { drive: 0, volume: 8 };
    try {
        const o = JSON.parse(localStorage.getItem(KEY) || "null");
        if (o) {
            // earlier versions had a distortion switch and a gain knob
            if (typeof o.drive === "boolean") st.drive = o.drive && o.gain >= 0 && o.gain <= 10 ? +o.gain : 0;
            else if (o.drive >= 0 && o.drive <= 10) st.drive = +o.drive;
            if (o.volume >= 0 && o.volume <= 10) st.volume = +o.volume;
        }
    } catch (e) {}
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

    /* ---------- audio ---------- */
    const chains = new WeakMap(), live = [];
    const preGain = () => 1 + Math.pow(st.drive / 10, 2) * 60; // 1× to 61× into the clipper
    const volume = () => st.volume / 8;                          // 8 is unity

    let curve = null;
    function clipCurve() {
        if (curve) return curve;
        curve = new Float32Array(4096);
        for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(2.5 * x); }
        return curve;
    }

    function build(ctx) {
        const input = ctx.createGain(), clean = ctx.createGain(), drive = ctx.createGain(), out = ctx.createGain();
        const tight = ctx.createBiquadFilter(); tight.type = "highpass"; tight.frequency.value = 110;
        const pre = ctx.createGain();
        const clip = ctx.createWaveShaper(); clip.curve = clipCurve(); clip.oversample = "4x";
        const mid = ctx.createBiquadFilter(); mid.type = "peaking"; mid.frequency.value = 900; mid.Q.value = 0.8; mid.gain.value = 4;
        const cab = ctx.createBiquadFilter(); cab.type = "lowpass"; cab.frequency.value = 3800; cab.Q.value = 0.9;
        const cab2 = ctx.createBiquadFilter(); cab2.type = "lowpass"; cab2.frequency.value = 6500;
        input.connect(clean).connect(out);
        input.connect(tight).connect(pre).connect(clip).connect(mid).connect(cab).connect(cab2).connect(drive).connect(out);
        out.connect(ctx.destination);
        const c = { ctx, input, clean, drive, pre, out };
        apply(c, true);
        return c;
    }

    function apply(c, now) {
        const t = c.ctx.currentTime, ramp = now ? 0 : 0.03;
        const set = (p, v) => { p.cancelScheduledValues(t); p.setTargetAtTime(v, t, ramp || 0.001); };
        set(c.clean.gain, st.drive > 0 ? 0 : 1);
        set(c.drive.gain, st.drive > 0 ? 0.32 : 0);
        set(c.pre.gain, preGain());
        set(c.out.gain, volume());
    }
    const applyAll = () => live.forEach((c) => { if (c.ctx.state !== "closed") apply(c); });

    function chainFor(ctx) {
        let c = chains.get(ctx);
        if (!c) { c = build(ctx); chains.set(ctx, c); live.push(c); }
        return c;
    }

    if (window.AudioNode && window.ScriptProcessorNode && window.AudioDestinationNode) {
        const connect = AudioNode.prototype.connect;
        AudioNode.prototype.connect = function (dest, ...rest) {
            if (this instanceof ScriptProcessorNode && dest instanceof AudioDestinationNode) {
                return connect.call(this, chainFor(this.context).input, ...rest);
            }
            return connect.call(this, dest, ...rest);
        };
    }

    /* ---------- panel ---------- */
    const panel = document.getElementById("amp");
    if (!panel) return;

    /* knobs: drag up or down, scroll, or use the arrow keys; 0 to 10 in tenths */
    panel.querySelectorAll(".knob").forEach((k) => {
        const key = k.dataset.k, val = k.querySelector(".kval");
        const set = (v) => {
            st[key] = Math.round(Math.max(0, Math.min(10, v)) * 10) / 10;
            k.style.setProperty("--a", (st[key] / 10) * 270 - 135 + "deg");
            k.setAttribute("aria-valuenow", st[key]);
            val.textContent = st[key].toFixed(1);
            applyAll();
        };
        set(st[key]);
        let y0 = 0, v0 = 0;
        k.addEventListener("pointerdown", (e) => {
            k.setPointerCapture(e.pointerId);
            y0 = e.clientY; v0 = st[key];
            k.classList.add("turning");
        });
        k.addEventListener("pointermove", (e) => { if (k.hasPointerCapture(e.pointerId)) set(v0 + (y0 - e.clientY) / 15); });
        const end = () => { k.classList.remove("turning"); save(); };
        k.addEventListener("pointerup", end);
        k.addEventListener("pointercancel", end);
        k.addEventListener("wheel", (e) => { e.preventDefault(); set(st[key] + (e.deltaY < 0 ? 0.5 : -0.5)); save(); }, { passive: false });
        k.addEventListener("keydown", (e) => {
            const d = { ArrowUp: 0.5, ArrowRight: 0.5, ArrowDown: -0.5, ArrowLeft: -0.5, PageUp: 2, PageDown: -2 }[e.key];
            if (e.key === "Home" || e.key === "End") { e.preventDefault(); set(e.key === "Home" ? 0 : 10); save(); return; }
            if (d === undefined) return;
            e.preventDefault(); set(st[key] + d); save();
        });
    });
})();

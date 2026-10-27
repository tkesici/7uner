/* 7uner – loads alphaTab (https://alphatab.net, MPL-2.0) from jsDelivr at a
   pinned version, once, for Practice and Tab Studio. */
(function () {
    "use strict";

    const VERSION = "1.8.4";
    const BASE = "https://cdn.jsdelivr.net/npm/@coderline/alphatab@" + VERSION + "/dist/";
    let loading = null;

    function load() {
        if (window.alphaTab) return Promise.resolve();
        if (loading) return loading;
        loading = new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = BASE + "alphaTab.min.js";
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => { loading = null; reject(new Error("script")); };
            document.head.appendChild(s);
        });
        return loading;
    }

    const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const colors = () => ({
        mainGlyphColor: cssVar("--ink"), secondaryGlyphColor: cssVar("--muted"), scoreInfoColor: cssVar("--ink"),
        staffLineColor: cssVar("--line"), barSeparatorColor: cssVar("--muted"), barNumberColor: cssVar("--muted")
    });

    /* settings shared by both players: rendering, sound font and fonts from the CDN */
    function baseSettings(scrollElement) {
        return {
            core: { scriptFile: BASE + "alphaTab.min.js", fontDirectory: BASE + "font/", includeNoteBounds: true },
            display: { staveProfile: "Tab", layoutMode: "Page", resources: colors() },
            player: {
                // the script-processor output needs no extra module download, so it also
                // works where loading an audio worklet from the CDN is blocked
                playerMode: "EnabledSynthesizer", outputMode: "WebAudioScriptProcessor",
                soundFont: BASE + "soundfont/sonivox.sf2", scrollElement,
                enableCursor: true, enableAnimatedBeatCursor: true, enableUserInteraction: true
            }
        };
    }

    /* follow the site's light/dark theme */
    function followTheme(getApi) {
        if (!window.matchMedia) return;
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
            const api = getApi();
            if (!api || !window.alphaTab) return;
            const c = colors(), r = api.settings.display.resources, C = window.alphaTab.model.Color;
            Object.keys(c).forEach((k) => { const v = C.fromJson(c[k]); if (v) r[k] = v; });
            api.updateSettings();
            api.render();
        });
    }

    /* alphaTab starts the beat cursor's animation towards the next note as
       soon as play is pressed, even when a count-in comes first, so during the
       count-in the cursor drifts into the first bar and stops there; when the
       music starts it isn't redrawn, because it already "is" on that note.
       This keeps the cursor on its starting place through the count-in, then
       replays alphaTab's animation from there as the music starts. */
    function holdCursorDuringCountIn(api, scoreEl) {
        let playing = false, counting = false, idle = "", wanted = {}, cursor = null;
        const obs = new MutationObserver(() => {
            const s = cursor.style;
            if (!counting) { if (!playing) idle = s.transform; return; }
            let touched = false;
            if (s.getPropertyPriority("transform") !== "important") { wanted.transform = s.transform; touched = true; }
            if (s.getPropertyPriority("transition") !== "important") { wanted.transition = s.transition; touched = true; }
            if (touched) hold();
        });
        function hold() {
            cursor.style.setProperty("transition", "none", "important");
            cursor.style.setProperty("transform", idle, "important");
        }
        // replay: the music has started, so run alphaTab's animation; otherwise
        // (stopped during the count-in) just leave the cursor where it was
        function release(replay) {
            counting = false;
            if (!cursor) return;
            const s = cursor.style;
            s.removeProperty("transition"); s.removeProperty("transform");
            s.transition = "none"; s.transform = idle;
            if (replay && wanted.transform) {
                void cursor.offsetWidth; // start the animation from the starting place
                s.transition = wanted.transition || "";
                s.transform = wanted.transform;
            }
            wanted = {};
        }
        api.renderFinished.on(() => {
            const c = scoreEl.querySelector(".at-cursor-beat");
            if (!c || c === cursor) return;
            obs.disconnect();
            cursor = c;
            idle = c.style.transform;
            obs.observe(c, { attributes: true, attributeFilter: ["style"] });
        });
        api.playerStateChanged.on((e) => {
            const now = e.state === 1;
            if (now && !playing) {
                counting = !!cursor && api.countInVolume > 0;
                if (counting) hold();
            } else if (now && counting) release(true); // the count-in is over
            else if (!now && counting) release(false);
            playing = now;
        });
    }

    window.at7 = { VERSION, BASE, load, baseSettings, followTheme, holdCursorDuringCountIn };
})();

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

    window.at7 = { VERSION, BASE, load, baseSettings, followTheme };
})();

# 7uner

A chromatic and instrument tuner, guitar practice exercises and a Guitar Pro tab player that run in the browser. No server, no build step, no dependencies: plain HTML, CSS and JavaScript.

## Files

```
index.html            Page skeleton (Tuner, Practice and Tab Studio pages)
css/style.css         All styles (light and dark themes)
js/pitch.js           Pitch detection (McLeod / NSDF), shared by anything that listens
js/tuner.js           Tuner: microphone input, string detection, pitch trace
js/alphatab.js        Loads alphaTab once for Practice and Tab Studio
js/exercises.js       Practice catalogue: names, descriptions, tempos
js/practice.js        Practice: plays the exercise files with alphaTab, in a loop
js/tab-studio.js      Tab Studio: opens, plays, loops and edits Guitar Pro / MusicXML files (alphaTab)
js/amp.js             The amp: distortion, gain and volume for everything alphaTab plays
js/metronome.js       The metronome beside the amp: swings at the playing tempo, sets tempo and click volume
js/app.js             Switching between #tuner, #practice and #tab-studio, offline support
practice/<id>.gp      The Practice exercises as Guitar Pro 7 files (generated, see below)
tools/                Dev-only scripts (Node): exercise files, asset hashes, git hook; not needed to run the site
sw.js                 Service worker: caches the app and the exercise files for offline use
manifest.webmanifest  Lets the app be installed to the home screen
favicon.svg
.nojekyll           Turns off Jekyll processing on GitHub Pages
```

## Running locally

Most browsers block the microphone on `file://` pages, so start a small local server:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Practice exercise files

The notes of every Practice exercise are stored as Guitar Pro 7 files in `practice/`, so they render and play exactly like files opened in Tab Studio (and can be opened in Guitar Pro). They are generated from the definitions in `tools/make-practice-files.js` and the catalogue in `js/exercises.js`. After changing either, regenerate them with Node:

```bash
cd tools && npm install && npm run practice
```

The script reads every file back after writing it and stops if any note differs. A new exercise needs an entry in `js/exercises.js` and, for techniques, its notes in the script; the service worker picks up the new file automatically.

## Cache-busting asset URLs

Every CSS and JS link in `index.html` carries a hash of the file's content (`css/style.css?v=36afc388`), and so do the exercise files and the service worker's precache list. When a file changes, its URL changes, so a CDN or browser cache can't serve an old stylesheet next to new HTML. (In front of 7uner.com, Cloudflare keeps CSS and JS for hours; without this, a deploy can show the new page with the old styles.)

The hashes are written by `tools/stamp-assets.js`. Run it before committing, or let git do it by turning on the hook in `tools/hooks` once per clone:

```bash
git config core.hooksPath tools/hooks
```

The hook stamps and re-adds `index.html`, `sw.js` and `js/exercises.js` to the commit.

## Publishing with GitHub Pages

1. Create a new repository (e.g. `7uner`) and put the contents of this folder at its root.
2. Go to Settings > Pages > Source: **Deploy from a branch**, Branch: `main`, folder: `/ (root)`.
3. After a minute or two the site is live at `https://<username>.github.io/7uner/`.

## Using your own domain

1. Enter the domain (e.g. `7uner.com`) under Settings > Pages > Custom domain. GitHub adds a `CNAME` file to the repository automatically.
2. In your domain provider's DNS settings:
   - Four `A` records for the apex domain (`7uner.com`): `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - One `CNAME` record for `www` pointing to `<username>.github.io`
3. Once DNS has propagated, tick **Enforce HTTPS**. Browsers only allow microphone access over HTTPS, so this step is required.

## Notes

- The tuner has two modes. **Chromatic** works with any instrument and shows the nearest note. **Guitar** follows six target strings, starting from standard tuning; each string can be moved up or down by a semitone, and common presets (drop D, E♭ standard, drop C, drop A and others) are one click away.
- The tuner's display is a strobe: a gauge shows how far off the note is, and in chromatic mode sound waves fan out from a tuning fork; their dashes drift left when flat and right when sharp, faster the further off, and stand still when the note is in tune. In instrument modes the same rings turn on the headstock post of the string being played. Tap a note to lock the tuner to that string; ▲ ▼ beside it retune it by a semitone. The A4 reference is under the ⚙ button. Under the gauge, a history trace scrolls down from the dot and fades, like a chart recorder. The display glides between readings, so a jump to a new note or string slides in rather than snapping.
- Guitar mode is stricter than chromatic mode: the in-tune zone is ±2 cents instead of ±5, the scale shows ±25 cents, readings use a longer analysis window, and the first moments of each pluck (which ring sharp) are ignored.
- Chromatic mode detects roughly 27 Hz to 4200 Hz; guitar mode 38 Hz to 1400 Hz.
- The A4 reference can be set between 415 and 466 Hz (440 by default). Mode, string tunings and A4 are saved in the browser.
- Practice plays each exercise at the tempo you set by changing alphaTab’s playback speed relative to the file’s own tempo (the exercise’s starting tempo).
- Everything Practice and Tab Studio play goes through one amp (beside the page heading, `js/amp.js`): a distortion switch, gain and volume, saved in the browser. The metronome goes through it too, so Volume 0 silences it as well.
- Beside the amp is a metronome (`js/metronome.js`). While Practice or Tab Studio plays, its rod swings at the playing tempo, kept in phase with the music. Sliding the weight or the − and + buttons (10 BPM a step) set the tempo; in Practice this is the only tempo control, and in Tab Studio it sets the speed relative to the song’s tempo. The knob on its right side sets the click and count-in volume (1.25× alphaTab’s default at the middle, 2.5× at the top); in Practice the click is always on and volume 0 silences it. The switch on its left side turns the one-bar count-in on (the default) or off, for both pages.
- Practice tempos and Tab Studio settings are stored in `localStorage` and don't carry over to other devices.
- Tab Studio uses [alphaTab](https://alphatab.net) (MPL-2.0), loaded from jsDelivr at a pinned version the first time Practice or Tab Studio needs it. Opened files are kept in the browser's IndexedDB and are never uploaded.
- Tab Studio shows and edits guitar tracks only; drums, bass and other instruments play as backing. Edited files are saved as a separate copy and downloaded as Guitar Pro 7 (.gp).
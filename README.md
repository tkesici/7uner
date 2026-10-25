# 7uner

A chromatic tuner and guitar level test that run in the browser. No server, no build step, no dependencies: plain HTML, CSS and JavaScript.

## Files

```
index.html          Page skeleton (Tuner and Level test tabs)
css/style.css       All styles (light and dark themes)
js/tuner.js         Tuner: microphone input, pitch detection (McLeod / NSDF), pitch trace
js/level-test.js    Level test: tab player, metronome, ear and improvisation tests
js/app.js           Switching between #tuner and #level-test
favicon.svg
.nojekyll           Turns off Jekyll processing on GitHub Pages
```

## Running locally

Most browsers block the microphone on `file://` pages, so start a small local server:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

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

- The tuner detects roughly 38 Hz to 1500 Hz, so low tunings such as drop A are covered.
- The A4 reference can be set between 415 and 466 Hz and is saved in the browser.
- Level test results are stored in `localStorage` and don't carry over to other devices.
# Daylight desktop (Windows and Linux)

The same Daylight agent as the web page, packaged as a desktop app with Electron.

## What is different from the web page

- **Your own Apify key in Settings.** The key is stored encrypted on the computer
  (Windows: DPAPI, Linux: system keyring; without a keyring it is stored in the user profile and the app says so).
- **The key never reaches the page.** All Apify calls go through the main process (`src/main.js`),
  so the key is not visible in the page source or DevTools.
- **Save the report as PDF or HTML** (light, print-friendly, all evidence expanded).
- **Works offline for reading CVs:** pdf.js is bundled, no CDN.
- **Licence key field** prepared for the paid plan (see `../docs/LICENSING.md`).
- Links in reports open in the system browser.

## Run from source

```bash
cd desktop
npm install
npm start
```

## Build installers

```bash
npm run dist:linux   # dist/Daylight-<version>.AppImage and .deb
npm run dist:win     # dist/Daylight-Setup-<version>.exe and Daylight-Portable-<version>.exe
```

Windows installers build best on Windows. The GitHub workflow `.github/workflows/desktop.yml`
builds both platforms in the cloud: Actions → Desktop build → Run workflow, then download the artifacts.

The Windows build is not code-signed, so Windows SmartScreen shows a warning on first start
("More info" → "Run anyway"). Signing needs a code-signing certificate.

## Which Actor does the app call?

By default `daylightwins~my-actor`. A user with their own Apify key can only call it if the Actor is
**public** (publish it in Apify Console → Actor → Publication) or if they deploy the `actor/` folder
into their own Apify account and put its ID into Settings → Actor ID.

## Files

| File | Purpose |
|---|---|
| `src/main.js` | Window, settings storage, Apify calls, PDF export, licence placeholder |
| `src/preload.js` | The only bridge the page can use (`window.daylight`) |
| `renderer/index.html` | The interface (same as `web/index.html`, plus Settings and export) |
| `build/icon.png` | App icon |

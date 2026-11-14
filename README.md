# Linkbook — local-first bookmark PWA

A dependency-free prototype for collecting links. Runs entirely in the browser, hosted as static files on GitHub Pages. **There is no application backend, authentication, external metadata proxy, or automatic cloud synchronization.**

## Features

- Paste and save `http(s)` links.
- Android Share Target integration when installed as a PWA in Chrome on Android (support varies by browser).
- Best-effort title, description, page image, favicon, author, publication date, and site metadata.
- YouTube thumbnails derived directly from video IDs; public GitHub repository descriptions via GitHub's CORS-enabled API.
- Neutral text-first fallback covers showing the website domain, favicon when available, and page title.
- Optional custom cover image uploads (locally resized), image URLs, or a forced simple cover.
- Grid/list display, sorting, search, tags, notes, manual editing, metadata retry, delete.
- Local IndexedDB database and JSON export/import (merge, skip duplicates).
- Offline app shell via service worker; saving is local even without a network. External preview images may not be available offline.

## Metadata limitation — important

Web browsers do **not** permit one origin to read most other sites' HTML due to CORS. When a page permits CORS, Linkbook fetches its HTML and parses Open Graph, Twitter Card, HTML meta tags, and JSON-LD data in the browser. If access is denied, it retains a usable basic bookmark (hostname, guessed title, favicon guess, and known-site image if possible). You can edit fields manually. When no image can be used, Linkbook displays a plain, neutral cover with the domain, favicon (or initial if missing), and page title.

[Defuddle by kepano](https://github.com/kepano/defuddle) was considered. It is excellent at extracting content and structured metadata from **HTML already available to the application**, but it cannot bypass CORS. For this small no-extension, no-proxy prototype, a small Open Graph/JSON-LD parser avoids a large dependency while addressing the HTML-accessible cases. Defuddle would become more useful if HTML capture (e.g. an extension or bookmarklet) is added later.

**No third-party proxy or paid metadata API is used.** External links, favicons, thumbnails and GitHub API requests naturally contact their corresponding hosts in your browser.

## Local development

Requires Node.js only for the optional development file server and test runner (not in production):

```bash
npm run dev
```

Open http://localhost:4173/ . Tests:

```bash
npm test
```

## GitHub Pages deployment

1. In GitHub, use the public repository [`teodor-andonov/261114_bookmarker`](https://github.com/teodor-andonov/261114_bookmarker).
2. Upload these files (including the hidden `.github/workflows/deploy.yml`) to the repository's `main` branch. You can also use `git init`, add, commit and push (example below).
3. Go to **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. The included workflow publishes these static files automatically on push to `main`. Once a deployment finishes successfully, the site will be at `https://teodor-andonov.github.io/261114_bookmarker/`.

Example from an unzipped folder:

```bash
git init -b main
git add .
git commit -m "Build local-first Linkbook PWA"
git remote add origin https://github.com/teodor-andonov/261114_bookmarker.git
git push -u origin main
```

No build or runtime server is required on Pages. All asset paths and the Share Target action use relative URLs so the app works at `/261114_bookmarker/`.

## Android installation and share

Open the deployed site with Chrome for Android, then use **Install app** / **Add to Home screen**. Once installed as a PWA, Chrome/Android can register it as a target in the Android share sheet. Share a link from a browser or app to Linkbook; the app detects URLs in the shared `url`, `text`, or `title` fields. Sometimes a shared title is also included.

## Data & privacy

Bookmarks live in IndexedDB on the **specific browser and site origin**. Installing a PWA commonly shares the browser's origin storage, but separate browser profiles/devices are independent. Clearing site data can remove bookmarks. **Export JSON regularly.** Uploaded cover images are included as compressed data in the JSON export, so backups can be larger. Importing merges records by URL. No account or sync is provided. Browser storage can be evicted, especially under storage pressure.

When you host this app on a **public GitHub repository**, the *app code* is public. Your bookmarks are **not** committed to that repository. Do not rely on browser-only storage as your sole copy of important references.

## Stack

Vanilla HTML / CSS / JavaScript modules, IndexedDB, web manifest, service worker, static GitHub Pages deployment via Actions. No frontend framework or npm dependencies.

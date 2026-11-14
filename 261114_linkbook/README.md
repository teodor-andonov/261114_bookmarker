# Linkbook — browser-only bookmark PWA

Standalone prototype inside Testlab. All runtime files, PWA assets and browser data logic live in this directory. No backend, account, server or shared Testlab libraries are required.

## Features

- Paste links, or use the Android Share Target when installed.
- Best-effort website metadata, image and favicon previews (direct cross-origin HTML access is often blocked by CORS).
- YouTube thumbnail URLs and public GitHub repository metadata.
- Neutral favicon/domain/title fallback covers; custom image upload or image URL override.
- Grid and list views, search, sorting, tags, notes, edits and deletion.
- IndexedDB persistence, JSON backup/restore and offline app shell.

## Development

From this folder:

```bash
npm run dev
npm test
```

All npm scripts use Node built-ins; there are no npm dependencies. Local app URL: <http://localhost:4173/>.

## Hosting

Testlab publishes this directory unchanged beneath its gallery. Its manifest, share target, style/script references and service-worker scope are **relative to this directory**, so it remains self-contained.

After the repository rename, open:

`https://teodor-andonov.github.io/261114_testlab/261114_linkbook/`

Bookmarks are stored locally in IndexedDB on the current browser's origin, not in the public repository. Use Export to back them up. An installed copy from the older `/261114_bookmarker/` location may need reinstallation from the new address.

# Linkbook — browser-only bookmark prototype

An ordinary web application inside Testlab; **not an independently installed PWA**. No backend, account, dedicated server, app manifest or active service worker is needed.

Features include direct URL input, best-effort metadata, YouTube thumbnails, favicon/domain/title fallback covers, manual covers, search, tags, notes, local IndexedDB, and JSON import/export. Metadata is limited by CORS; this does not add an external metadata API.

## Development

```bash
npm run dev
npm test
```

Uses only built-in Node development/test tools; browser runtime needs no npm dependencies.

## Hosting

The Testlab workflow publishes this entire folder under:

https://teodor-andonov.github.io/261114_testlab/261114_linkbook/

The browser still stores bookmarks locally in IndexedDB. The legacy Linkbook service-worker registration is automatically unregistered **only when its exact old scope matches this folder**. This cleanup does not touch the gallery worker or other repositories. The Android share-target integration was removed along with the Linkbook manifest; direct URL entry remains available.

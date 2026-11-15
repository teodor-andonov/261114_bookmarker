# Linkbook — browser-only bookmark prototype

An ordinary web application inside Testlab; **not an independently installed PWA**. No backend, account, dedicated server, app manifest or active service worker is needed.

Features include direct URL input, optional Defuddle-hosted metadata, YouTube thumbnails, favicon/domain/title fallback covers, manual covers, search, tags, notes, local IndexedDB, and JSON import/export. Bookmark data remains on-device; the requested public URL is sent to Defuddle for metadata, with no account or API key. If the request fails (e.g. rate limit), the locally saved bookmark remains usable.

Defuddle's hosted **Markdown frontmatter** contains title, description, site, domain, author and publication date, but **not** the `favicon` or `image` fields available in its local library. Linkbook therefore uses the original website's `/favicon.ico` as its favicon fallback and preserves YouTube previews and manually chosen covers. It does not claim to extract a main webpage image from this hosted endpoint.

The original favicon / title / domain graphic cover layout remains unchanged. The optional remote request never includes Linkbook notes, tags or backups.

## Development

```bash
npm run dev
npm test
```

Uses only built-in Node development/test tools; browser runtime needs no npm dependencies.

## Hosting

The Testlab workflow publishes this entire folder under:

https://teodor-andonov.github.io/261114_testlab/261114_linkbook/

Linkbook version lives in `package.json` (`v0.2.0-alpha.1`) and appears on its Testlab gallery card, together with Git creation and update timestamps. Individual prototypes no longer display version badges. The gallery build injects the shared floating Home/theme controls, while `testlab-theme.css` supplies the dark colour palette.

The browser still stores bookmarks locally in IndexedDB. The legacy Linkbook service-worker registration is automatically unregistered **only when its exact old scope matches this folder**. This cleanup does not touch the gallery worker or other repositories. The Android share-target integration was removed along with the Linkbook manifest; direct URL entry remains available.

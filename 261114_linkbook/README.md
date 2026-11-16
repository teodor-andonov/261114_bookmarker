# Linkbook — browser-only bookmark prototype

An ordinary web application inside Testlab; **not an independently installed PWA**. No backend, account, dedicated server, app manifest or active service worker is needed.

**Current version:** `v0.3.0-alpha.1` (displayed only in the Testlab gallery).

## One extraction path

Paste a URL and press **Enter**. Linkbook immediately saves it to IndexedDB, then calls **Defuddle's hosted API** once for metadata and cleaned article Markdown. It stores the title, website, description (or an excerpt from content), author, publication date, and up to 100,000 characters of extracted Markdown for local reading and search. Personal notes and tags are stored locally and never sent to Defuddle.

The hosted API does **not** return explicit `image` or `favicon` fields, even though the Defuddle library can identify them. Linkbook therefore selects the first usable image **embedded in the article Markdown**, if any. This is not guaranteed to be a hero image. Known YouTube video IDs use YouTube's deterministic thumbnail URL, which is why YouTube works more reliably. When no image is found or it fails to load, the cover remains the simple favicon / title / domain graphic. Favicons use the target site's `/favicon.ico` fallback; some websites do not publish one there. Linkbook does not invent covers or use a second metadata service.

## Commands and refresh

Only one management button, **Commands**, is displayed in the Linkbook header. Open it using that button or **Ctrl/⌘+K**, type to search commands, and press Enter. Available actions include **Refresh all links with Defuddle**, **Refresh selected link**, grid/list switching, tag filters, editing and deletion, JSON import/export, and copying locally extracted Markdown. Clicking a card's body opens details; clicking its cover opens the actual website.

**Refresh all links** processes the currently saved bookmarks in sequence (not a parallel burst). The message area shows progress and success/failure counts. There is a **Stop refreshing links** command. A Defuddle HTTP 429 rate-limit response stops the batch automatically. Failed fetches preserve old metadata; successful ones replace extracted fields while preserving URLs, IDs, created dates, notes and tags. Bookmarks are not synchronised to any server.

There is one automatic cover system. The previous upload/manual-image options are no longer shown or used for rendering. Their legacy data is **left intact in existing IndexedDB records and JSON backups** for safety; no migration deletes it. Backup import/export remains format version 1 and now includes extracted Markdown.

To save edited bookmark details: **Ctrl/⌘+Enter** in the details dialog, or Commands → Save bookmark changes. **Esc** closes without saving.

Remote content and image URLs may fail due to blocked fetches, inaccessible websites or rate limits. Extracted article text is locally stored, but a bookmark still points to its original live webpage; this is not an offline archive of all its assets.

## Development

```bash
npm run dev
npm test
```

Uses only built-in Node development/test tools; browser runtime needs no npm dependencies.

## Hosting

The Testlab workflow publishes this entire folder under:

https://teodor-andonov.github.io/261114_testlab/261114_linkbook/

The Testlab gallery owns version/timestamp reporting and injects the shared theme and Home controls. Linkbook's `testlab-theme.css` supplies its dark palette.

The browser still stores bookmarks locally in IndexedDB. The legacy Linkbook service-worker registration is automatically unregistered **only when its exact old scope matches this folder**. This cleanup does not touch the gallery worker or other repositories. The Android share-target integration was removed along with the Linkbook manifest; direct URL entry remains available.

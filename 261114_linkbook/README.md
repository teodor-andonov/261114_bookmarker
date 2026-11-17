# Linkbook — browser-only bookmark prototype

An ordinary web application inside Testlab; **not an independently installed PWA**. No backend, account, dedicated server, app manifest or active service worker is needed.

**Current version:** `v0.3.0-alpha.3` (displayed only in the Testlab gallery).

## One extraction path

Paste a URL and press **Enter**. Linkbook immediately saves it to IndexedDB, then calls **Defuddle's hosted API** once for metadata and cleaned article Markdown. It stores the title, website, description (or an excerpt from content), author, publication date, and up to 100,000 characters of extracted Markdown for local reading and search. Personal notes and tags are stored locally and never sent to Defuddle.

The hosted API does **not** return explicit `image` or `favicon` fields, even though the Defuddle library can identify them. Linkbook therefore selects the first usable image **embedded in the article Markdown**, if any. This is not guaranteed to be a hero image. Known YouTube video IDs use YouTube's deterministic thumbnail URL, which is why YouTube works more reliably. When no image is found or it fails to load, the cover area is intentionally **empty**. The bookmark's favicon, domain and title remain visible below the cover area on the card. Favicons use the target site's `/favicon.ico` fallback; some websites do not publish one there. Linkbook does not invent covers or use a second metadata service.

## Side-by-side screenshot service comparison (experimental)

Run **Commands → Compare screenshots: Microlink vs Thum.io** (or Ctrl/⌘+K, search `compare`). Use the URL already pasted into the Save field, the selected bookmark, or enter another public URL in the comparison dialog and press **Enter**. Both previews appear side by side; on mobile they stack. **Esc** closes the dialog.

- **Microlink**: `api.microlink.io`, screenshot-only JSON request (`meta=false`), desktop `1200×750`, JPEG at quality 75, no scrolling. After receiving `data.screenshot.url`, Linkbook displays the CDN image. Errors and daily free-tier limits are reported.
- **Thum.io**: direct `image.thum.io/get/width/600/crop/750/noanimate/...` image endpoint. Its free viewport width defaults to 1200px; the first 750px are cropped and resized to 600px wide. A failed image load is reported, but Thum.io does not expose structured error details via an image tag.

Comparison is **opt-in**, one request per provider per comparison. No screenshot requests happen in the bookmark grid, and neither result replaces the existing Defuddle/YouTube cover or enters IndexedDB. Each third-party service receives **only the target URL** (no notes/tags). Local/private URLs are rejected. Provider quotas, bot protection, cookie banners, asynchronous rendering, and Thum.io's possible initial loader can affect results. Microlink publicly advertises 25 free requests/day, and Thum.io advertises 1,000 free impressions/month; verify current terms before heavier use.

Docs: https://microlink.io/docs/api/parameters/screenshot and https://www.thum.io/documentation/api/url .

## Commands and refresh

Only one management button, **Commands**, is displayed in the Linkbook header. Open it using that button or **Ctrl/⌘+K**, type to search commands, and press Enter. Available actions include **Refresh all links with Defuddle**, **Refresh selected link**, grid/list switching, tag filters, editing and deletion, JSON import/export, and copying locally extracted Markdown. Clicking a card's body opens details; clicking its cover opens the actual website.

**Refresh all links** processes the currently saved bookmarks in sequence (not a parallel burst). The message area shows progress and success/failure counts. There is a **Stop refreshing links** command. A Defuddle HTTP 429 rate-limit response stops the batch automatically. Failed fetches preserve old metadata; successful ones replace extracted fields while preserving URLs, IDs, created dates, notes and tags. Bookmarks are not synchronised to any server.

There is one automatic cover system: a genuine extracted image or a blank cover. The previous upload/manual-image options are no longer shown or used for rendering. Their legacy data is **left intact in existing IndexedDB records and JSON backups** for safety; no migration deletes it. Backup import/export remains format version 1 and now includes extracted Markdown.

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

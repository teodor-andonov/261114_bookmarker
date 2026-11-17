# Linkbook — browser-only bookmark prototype

An ordinary web application inside Testlab; **not an independently installed PWA**. No backend, account, dedicated server, app manifest or active service worker is needed.

**Current version:** `v0.3.0-alpha.3` (displayed only in the Testlab gallery).

## One extraction path

Paste a URL and press **Enter**. Linkbook immediately saves it to IndexedDB, then calls **Defuddle's hosted API** once for metadata and cleaned article Markdown. It stores the title, website, description (or an excerpt from content), author, publication date, and up to 100,000 characters of extracted Markdown for local reading and search. Personal notes and tags are stored locally and never sent to Defuddle.

The hosted API does **not** return explicit `image` or `favicon` fields, even though the Defuddle library can identify them. Linkbook therefore selects the first usable image **embedded in the article Markdown**, if any. This is not guaranteed to be a hero image. Known YouTube video IDs use YouTube's deterministic thumbnail URL, which is why YouTube works more reliably. When no image is found or it fails to load, the cover area is intentionally **empty**. The bookmark's favicon, domain and title remain visible below the cover area on the card. Favicons use the target site's `/favicon.ico` fallback; some websites do not publish one there. Linkbook does not invent covers or use a second metadata service.

## Thum.io screenshot preview (experimental)

Run **Commands → Preview screenshot with Thum.io** (or Ctrl/⌘+K, search `screenshot`). It starts with the URL in the Save field or selected bookmark; enter a public URL to preview another site. Each capture is on demand and temporary. **Enter** in the URL field captures with the selected settings; **Esc** closes the dialog. There is no extra toolbar button.

Thum.io free-tier settings, available directly in the preview dialog:

| Setting | Default | Choices |
| --- | --- | --- |
| Output image width (`width`) | 600px | 400 / 600 / 800 / 1200 |
| Original screenshot crop height (`crop`) | 750px | 500 / 750 / 900 / 1200 |
| Image format | Automatic | Automatic / JPG if possible / PNG |
| Maximum cache age (`maxAge`) | 24 hours | 0 / 24 / 168 hours |

The **browser viewport width stays 1200px** on Thum.io's free tier; changing output width only resizes the returned image. `noanimate` is enabled for a final still preview. Paid Better tier is needed for arbitrary browser viewport width, device emulation, waiting after load or full-page screenshots. The free tier may show branded loading and can fail on sites with bot protection or authentication.

**Defuddle remains active** for metadata, titles and locally saved searchable article Markdown. Screenshot previews do not modify existing Defuddle-derived covers or enter IndexedDB. They only send the target URL to Thum.io—not local notes, tags or the bookmark database. Local/private targets are rejected. Thum.io advertises the first 1,000 screenshot hits free (check current usage terms before running bulk previews).

Documentation: https://www.thum.io/documentation/api/url

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

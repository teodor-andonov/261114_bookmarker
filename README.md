# Testlab — small, independent app prototypes

A collection of quick experiments deployed together on **GitHub Pages**, with a landing page at the repository root. **No backend, runtime server, shared application framework or build dependencies.**

## Structure

```text
index.html                        # Testlab gallery
site.css / site.js                # Gallery styling and interactions
.github/workflows/deploy.yml     # One Pages deployment for the whole repo
.github/scripts/build_site.py    # Discovers prototype folders
261114_linkbook/                 # First self-contained PWA
  index.html
  app.js / styles.css / db.js / ...
  manifest.webmanifest / sw.js
  icons/
  prototype.json                 # Gallery card metadata
```

## Add a prototype

1. Create a folder named `YYMMDD_app-name` (example: `261115_canvas-test`).
2. Put a working `index.html` and **all** the app's runtime assets in that folder. Use relative asset URLs (`./styles.css`, `./app.js`) rather than repository-root paths.
3. Optionally add `prototype.json` with `title`, `description`, `category`, `status`, `monogram` and `tags` fields. If omitted, the gallery uses the folder name.
4. Commit and push to `main`. GitHub Actions discovers the new folder, builds `catalog.json`, and deploys the gallery and every prototype together.

Each prototype remains standalone: no shared libraries or parent-page dependency are required. The root gallery is only a launcher/index.

## Preview locally

Requires Python 3 (standard library only):

```bash
python3 .github/scripts/build_site.py
python3 -m http.server 4173 --directory dist
```

Open <http://localhost:4173/>. Individual prototypes may provide their own development commands inside their folders.

## Pages and repository rename

Target repository name: **`261114_testlab`**. After renaming from `261114_bookmarker` in **Settings → General → Repository name**, verify **Settings → Pages → Source → GitHub Actions** is still selected.

Expected URLs after the rename and successful deployment:

- Gallery: `https://teodor-andonov.github.io/261114_testlab/`
- Linkbook: `https://teodor-andonov.github.io/261114_testlab/261114_linkbook/`

Linkbook's existing IndexedDB data belongs to the origin `https://teodor-andonov.github.io`, not to the URL path. The relocated app therefore accesses the same origin database in the same browser profile. **But the old installed PWA has an old launch URL/scope**; open the new Linkbook URL and reinstall it. Export your bookmarks as a precaution before changing installations or clearing site data.

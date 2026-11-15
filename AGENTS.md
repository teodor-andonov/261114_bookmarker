# Testlab agent guidance

## Purpose
Independent experiments published as static applications through GitHub Pages. Each prototype belongs in its own `YYMMDD_slug/` folder and is discovered from `prototype.json`.

## Runtime boundaries
- Browser-only client applications. Do not introduce application servers, remote storage, authentication services, server APIs, or backend compute.
- Build tools such as Vite, npm and GitHub Actions are allowed at development/deployment time; there must be no server process required at runtime.
- A prototype may use JavaScript, WebAssembly, browser Web Workers, Three.js and other browser-compatible libraries.
- Treat prototypes as independent. Do not impose shared frameworks or storage schemes on them.
- The gallery is an installable PWA; individual prototypes may opt in to their own offline support when required. Keep service workers scoped to their own folders and respect the shared GitHub Pages origin.

## Data and files
- Prefer user-controlled files: open/import using file pickers and save/export to the user's file system.
- Do not add persistent browser databases or model-data storage without a requirement. In-memory state is fine; Cache Storage for offline app assets is fine.
- Keep exported formats honest. Do not mislabel tessellated geometry as exact CAD B-rep or NURBS geometry.

## Changes and commits
- Before work, check for uncommitted work and commit it first when present. GitHub-API-only changes start from a committed branch, so there is no local worktree to reconcile.
- Commit the completed changes after work. One commit is normally enough; use multiple logical commits for larger work or when connector operations require it.
- Keep existing experiments and gallery functionality intact.
- Verify syntax, builds and published deployment when possible; report anything that could not be tested.

## Prototype versions and release reporting
- Give each independently deployed prototype its own explicit SemVer prerelease, e.g. `v0.2.0-alpha.1`. This is **an app version**, not the Testlab gallery's version. Bump that version for a user-facing feature release (patch for fixes, minor for capabilities, prerelease suffix as needed). Existing prototypes do not need retroactive versions.
- Show **both** the app's version and its deployed **short Git commit SHA** in that prototype's UI. For Vite-built apps, inject the build SHA from `GITHUB_SHA` (and use a local Git fallback in development). Don't hand-type a SHA in the UI; every deployment must identify its exact source commit.
- Store the version alongside the prototype's source (e.g. `package.json`) and document where it appears. Never claim a version is live solely because the source commit exists.
- After commits, tell the user **the version, full/short commit SHA, and direct published URL**, ideally with a `?v=<SHA>` cache-busting query. Verify GitHub Actions/Pages publication status when possible; distinguish committed, CI green, and live deployed.
- Prefer one release commit for related changes, or logical increments if connector operations require multiple commits. The last release commit and the UI SHA must correspond to the actual deployment being described.

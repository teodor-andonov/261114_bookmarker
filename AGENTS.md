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

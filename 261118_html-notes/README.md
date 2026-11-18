# HTML Notes

Version 0.2.0-alpha.1. No backend, build step, account or document database. Open and save ordinary HTML files through Chromium File System Access; other browsers can select files/folders and download new copies. Multiple roots are kept in memory for the current session. Ctrl+S saves, Ctrl+Shift+S saves as, Ctrl+O opens, Ctrl+K opens the command palette. Type / in the visual editor for contextual insert and formatting commands; filter by typing, use Up/Down and Enter or Tab, Escape closes. Table insertion creates a 3-column, 2-row starter table without prompts; Tab moves between cells and adds a row at the end. Empty checklist items exit on Enter. Drag files into a note or paste image files. Ctrl+click a link or attachment to open/download it. Source mode edits only the semantic document body, not the binary payload.

## File layout

- Normal HTML head, offline document stylesheet, and semantic article with id html-notes-body.
- Body image and attachment elements reference an asset ID via data-asset.
- At the end: an inert application/json script block with an array of asset records (id, name, mime, base64 data). Each record is on its own line. Unreferenced assets are omitted on save.
- A short fixed viewer script resolves references to local Blob URLs when opened in a browser. Text remains readable with JavaScript disabled; embedded assets require that resolver. This script is not executed by the editor during import. External content is not requested by the editor; links require an explicit Ctrl+click. Non-raster assets are treated as downloads, never executed or rendered inline.
- Ordinary HTML can be imported as editable semantic content; original styles, scripts, arbitrary widgets and external or relative images are not preserved. Standard base64 raster images are converted to embedded asset records. This is a note editor, not a lossless web-page editor.

## Verification

JavaScript syntax, manifest JSON and local element cross-references checked; the viewer resolver was exercised with mocked image and arbitrary-file references and preserved bytes and download MIME. Interactive browser testing remains outstanding. Manual smoke test:

1. Open two different folders, expand subfolders, open a note.
2. Format headings, lists, tasks and tables; paste a raster image and attach a PDF or other file.
3. Toggle source: verify that only semantic HTML is shown, not base64.
4. Save as HTML, open the output directly in a browser and verify rendering and attachment downloads. Reopen it in the editor; confirm checked tasks, text and asset bytes survive.
5. Save back to the original, refresh folder tree, test unsaved-change prompts.
6. Install/open offline after a successful online visit; verify narrow/mobile layout and fallback pickers.
7. Open an HTML page containing a script and remote image, confirm neither executes nor requests remote content in the editor.

The initial editor uses browser contenteditable and execCommand for compact native editing; this deprecated API is a prototype choice and should be replaced if inconsistent editing behavior emerges. Very large embedded files use more RAM and approximately 33% more raw storage due to base64. Browser filesystem support and PWA installation vary by platform.

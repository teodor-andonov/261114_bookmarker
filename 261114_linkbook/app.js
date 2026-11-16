import { listBookmarks, getBookmark, getByUrl, saveBookmark, deleteBookmark } from './db.js';
import { normalizeUrl, safeImageUrl, fallbackMetadata, getMetadata, urlFromShare, parsePublicationDate } from './metadata.js';
import { coverImage, isLocalCover } from './cover.js';
import { mergeEnrichment } from './refresh.js';

const $ = id => document.getElementById(id);
const els = {
  addForm: $('addForm'), url: $('urlInput'), message: $('message'),
  count: $('totalCount'), search: $('searchInput'), sort: $('sortSelect'),
  list: $('bookmarkList'), empty: $('emptyState'), emptyTitle: $('emptyTitle'), emptyDescription: $('emptyDescription'),
  commandsButton: $('commandsButton'), commandsDialog: $('commandsDialog'),
  commandSearch: $('commandSearch'), commandResults: $('commandResults'),
  importFile: $('importFile'),
  dialog: $('detailDialog'), detailForm: $('detailForm'), metadataStatus: $('detailMetadataStatus')
};
const state = {
  bookmarks: [], view: getSavedView(), selectedTag: '', selectedId: null,
  loading: false, refreshing: false, stopRefresh: false
};

function getSavedView() {
  try { return localStorage.getItem('linkbook-view') === 'list' ? 'list' : 'grid'; }
  catch { return 'grid'; }
}
function saveView(view) { try { localStorage.setItem('linkbook-view', view); } catch { /* optional preference */ } }
function escapeHtml(raw) { return String(raw ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character])); }
function displayDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}
function domainOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }
function notify(text, type = '') { els.message.textContent = text; els.message.className = `message ${type}`.trim(); }
async function reload() { state.bookmarks = await listBookmarks(); render(); }

function filteredBookmarks() {
  const needle = els.search.value.trim().toLocaleLowerCase();
  const matched = state.bookmarks.filter(b => {
    if (state.selectedTag && !(b.tags || []).includes(state.selectedTag)) return false;
    if (!needle) return true;
    return [b.url, b.title, b.description, b.siteName, b.author, b.notes, b.contentMarkdown, ...(b.tags || [])].some(v => String(v || '').toLocaleLowerCase().includes(needle));
  });
  const sort = els.sort.value;
  matched.sort((a, b) => {
    if (sort === 'oldest') return String(a.createdAt).localeCompare(String(b.createdAt));
    if (sort === 'title') return String(a.title).localeCompare(String(b.title));
    if (sort === 'domain') return domainOf(a.url).localeCompare(domainOf(b.url));
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });
  return matched;
}

function coverMarkup(bookmark) {
  // No synthetic cover graphic: keep the frame empty if no image was extracted.
  const photo = coverImage(bookmark);
  return `<div class="preview">${photo
    ? `<img class="preview-image" src="${escapeHtml(photo)}" loading="lazy" referrerpolicy="no-referrer" alt="" />`
    : ''}</div>`;
}

function cardHtml(b) {
  const domain = domainOf(b.url);
  const hasPhoto = Boolean(coverImage(b));
  const icon = safeImageUrl(b.favicon, b.url);
  const favicon = icon
    ? '<img class="favicon" src="' + escapeHtml(icon) + '" loading="lazy" referrerpolicy="no-referrer" alt="" />'
    : '<span class="favicon is-hidden"></span>';
  const tags = (b.tags || []).slice(0, 3).map(tag => '<span class="inline-tag">' + escapeHtml(tag) + '</span>').join('');
  return '<article class="bookmark-card ' + (hasPhoto ? '' : 'no-cover-image') + '" data-id="' + escapeHtml(b.id) + '" tabindex="0" role="button" aria-label="Edit details: ' + escapeHtml(b.title) + '">' +
    '<a class="bookmark-cover-link" href="' + escapeHtml(b.url) + '" target="_blank" rel="noopener noreferrer" aria-label="Open ' + escapeHtml(b.title) + '">' + coverMarkup(b) + '</a>' +
    '<div class="bookmark-body">' +
      '<div class="bookmark-meta">' + favicon + '<span class="favicon-fallback">' + escapeHtml((domain[0] || 'L').toUpperCase()) + '</span><span class="domain">' + escapeHtml(domain) + '</span></div>' +
      '<h3 title="' + escapeHtml(b.title) + '">' + escapeHtml(b.title || domain) + '</h3>' +
      '<p class="description">' + escapeHtml(b.description || 'Saved for later') + '</p>' +
      (tags ? '<div class="inline-tags">' + tags + '</div>' : '') +
      '<div class="bookmark-foot"><span class="date-added">' + escapeHtml(displayDate(b.createdAt)) +
      '</span><span class="card-hint">Select to edit · Cover to open</span></div>' +
    '</div></article>';
}

function availableTags() {
  return [...new Set(state.bookmarks.flatMap(bookmark => bookmark.tags || []))].sort((a,b)=>a.localeCompare(b));
}

function render() {
  els.count.textContent = String(state.bookmarks.length);
  if (state.selectedTag && !availableTags().includes(state.selectedTag)) state.selectedTag = '';
  const bookmarks = filteredBookmarks();
  els.list.className = state.view === 'list' ? 'bookmark-grid list-view' : 'bookmark-grid';
  els.list.innerHTML = bookmarks.map(cardHtml).join('');
  els.empty.hidden = bookmarks.length !== 0;
  if (state.bookmarks.length === 0) {
    els.emptyTitle.textContent = 'Nothing saved yet.';
    els.emptyDescription.textContent = 'Paste a URL above to start collecting.';
  } else {
    els.emptyTitle.textContent = 'No matching bookmarks.';
    els.emptyDescription.textContent = 'Try another search or tag filter.';
  }
}

async function enrichBookmark(bookmark, sharedTitle) {
  const enriched = await getMetadata(bookmark.url, sharedTitle);
  const current = await getBookmark(bookmark.id);
  if (!current || current.updatedAt !== bookmark.updatedAt) return;
  if (enriched.metadataSource === 'basic') {
    await saveBookmark(mergeEnrichment(current, enriched));
    await reload();
    notify('Link saved. Metadata unavailable: ' + (enriched.metadataError || 'No article found'), 'error');
    return;
  }
  await saveBookmark(mergeEnrichment(current, enriched));
  await reload();
  notify(enriched.image ? 'Link enriched with article text and image.' : 'Link enriched with text; no usable article image found.', 'success');
}

async function createBookmark(rawUrl, sharedTitle = '') {
  const url = normalizeUrl(rawUrl);
  const existing = await getByUrl(url);
  if (existing) { notify('This link is already saved.', 'success'); openEditor(existing.id); return false; }
  const now = new Date().toISOString();
  const bookmark = {
    id: crypto.randomUUID(), url, ...fallbackMetadata(url, sharedTitle),
    notes: '', tags: [], source: sharedTitle ? 'share' : 'paste', createdAt: now, updatedAt: now
  };
  await saveBookmark(bookmark);
  await reload();
  notify('Saved locally. Fetching article metadata and text via Defuddle…', 'success');
  // Save first; attempt metadata enrichment without blocking the Add button.
  void enrichBookmark(bookmark, sharedTitle).catch(error => notify('Metadata could not be saved: '+error.message,'error'));
  return true;
}

function formControl(name) { return els.detailForm.elements.namedItem(name); }

function fillEditor(bookmark) {
  state.selectedId = bookmark.id;
  for (const name of ['title', 'url', 'description', 'author', 'published', 'notes']) {
    formControl(name).value = bookmark[name] || '';
  }
  formControl('tags').value = (bookmark.tags || []).join(', ');
  formControl('contentMarkdown').value = bookmark.contentMarkdown || '';
  const source = bookmark.metadataSource === 'defuddle-api'
    ? 'Defuddle · ' + (bookmark.image ? 'article image available' : 'no article image') +
      ' · ' + (bookmark.contentMarkdown ? 'full text stored locally' : 'no text extracted')
    : 'No successful Defuddle extraction yet';
  els.metadataStatus.textContent = source +
    (bookmark.metadataError ? ' · Last error: ' + bookmark.metadataError : '');
}

async function openEditor(id) {
  try {
    const bookmark = await getBookmark(id);
    if (!bookmark) return;
    fillEditor(bookmark);
    if (!els.dialog.open) els.dialog.showModal();
  } catch (error) { notify(error.message, 'error'); }
}

// A URL is saved with Enter; operational actions live in the command palette.
els.addForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (state.loading) return;
  state.loading = true;
  try { const saved = await createBookmark(els.url.value); if (saved) els.url.value = ''; }
  catch (error) { notify(error.message || 'Unable to save this link.', 'error'); }
  finally { state.loading = false; }
});

els.list.addEventListener('click', event => {
  if (event.target.closest('a')) return; // Image opens the original URL.
  const id = event.target.closest('.bookmark-card')?.dataset.id;
  if (id) void openEditor(id);
});
els.list.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.target !== event.target.closest('.bookmark-card')) return;
  event.preventDefault();
  const id = event.target.dataset.id;
  if (id) void openEditor(id);
});
els.list.addEventListener('error', event => {
  if (event.target instanceof HTMLImageElement) event.target.classList.add('is-hidden');
}, true);
els.search.addEventListener('input', render);
els.sort.addEventListener('change', render);
els.dialog.addEventListener('click', event => {
  if (event.target === els.dialog) els.dialog.close();
});

els.detailForm.addEventListener('submit', async event => {
  event.preventDefault();
  const id = state.selectedId;
  if (!id) return;
  try {
    const current = await getBookmark(id);
    if (!current) throw new Error('Bookmark no longer exists.');
    const url = normalizeUrl(formControl('url').value);
    const another = await getByUrl(url);
    if (another && another.id !== id) throw new Error('Another bookmark already uses that URL.');
    const tags = [...new Set(formControl('tags').value.split(',').map(x => x.trim()).filter(Boolean))].slice(0, 30);
    const urlChanged = url !== current.url;
    const saved = {
      ...current,
      ...(urlChanged ? {...fallbackMetadata(url), contentMarkdown: '', metadataError: '', metadataCheckedAt: ''} : {}),
      url, title: formControl('title').value.trim().slice(0, 500),
      description: formControl('description').value.trim().slice(0, 5000),
      author: formControl('author').value.trim().slice(0, 300),
      published: parsePublicationDate(formControl('published').value),
      tags, notes: formControl('notes').value.slice(0, 10000),
      updatedAt: new Date().toISOString()
    };
    if (!saved.title) throw new Error('Title cannot be empty.');
    await saveBookmark(saved);
    els.dialog.close();
    await reload();
    notify('Bookmark details saved.', 'success');
    if (urlChanged) void enrichBookmark(saved);
  } catch (error) {
    notify(error.message, 'error');
    els.metadataStatus.textContent = error.message;
  }
});

async function deleteSelectedBookmark() {
  if (!state.selectedId || !confirm('Delete the selected bookmark from this browser?')) return;
  try {
    await deleteBookmark(state.selectedId);
    state.selectedId = null;
    els.dialog.close();
    await reload();
    notify('Bookmark deleted.', 'success');
  } catch (error) { notify(error.message, 'error'); }
}

// Refresh only automatically extracted fields; notes, tags and creation dates survive.
// If a user edits a bookmark while a request is running, do not overwrite those edits.
async function refreshBookmark(id) {
  const current = await getBookmark(id);
  if (!current) return {status: 'skipped'};
  const result = await getMetadata(current.url);
  const latest = await getBookmark(id);
  if (!latest || latest.updatedAt !== current.updatedAt) return {status: 'skipped'};
  if (result.metadataSource === 'basic') {
    await saveBookmark(mergeEnrichment(latest, result));
    return {status: 'failed', error: result.metadataError || 'No metadata returned'};
  }
  await saveBookmark(mergeEnrichment(latest, result));
  return {status: 'updated', image: Boolean(result.image), content: Boolean(result.contentMarkdown)};
}

async function refreshSelectedBookmark() {
  if (!state.selectedId) return;
  const result = await refreshBookmark(state.selectedId);
  await reload();
  if (els.dialog.open) {
    const current = await getBookmark(state.selectedId);
    if (current) fillEditor(current);
  }
  notify(result.status === 'updated' ? 'Bookmark refreshed using Defuddle.' :
    'Refresh did not update bookmark: ' + (result.error || result.status),
    result.status === 'updated' ? 'success' : 'error');
}

async function refreshAllBookmarks() {
  if (state.refreshing) return;
  const ids = (await listBookmarks()).map(item => item.id);
  if (!ids.length) { notify('No bookmarks to refresh.'); return; }
  state.refreshing = true;
  state.stopRefresh = false;
  let updated = 0, failed = 0, skipped = 0, images = 0;
  try {
    for (let i = 0; i < ids.length; i++) {
      if (state.stopRefresh) break;
      notify('Refreshing ' + (i + 1) + '/' + ids.length + ' · ' +
        updated + ' updated, ' + failed + ' failed');
      const result = await refreshBookmark(ids[i]);
      if (result.status === 'updated') { updated++; if (result.image) images++; }
      else if (result.status === 'failed') {
        failed++;
        // Respect the hosted free-tier rate limit; do not keep hammering.
        if (/HTTP 429/i.test(result.error || '')) {
          state.stopRefresh = true;
          notify('Defuddle rate limit reached; refresh stopped. ' + updated +
            ' updated, ' + failed + ' failed.', 'error');
        }
      } else skipped++;
      await reload();
      if (i < ids.length - 1 && !state.stopRefresh) await new Promise(resolve => setTimeout(resolve, 350));
    }
  } catch (error) {
    notify('Refresh interrupted: ' + error.message, 'error');
    return;
  } finally {
    state.refreshing = false;
    await reload();
  }
  notify('Refresh ' + (state.stopRefresh ? 'stopped' : 'finished') + ': ' +
    updated + ' updated (' + images + ' with images), ' + failed +
    ' unavailable, ' + skipped + ' skipped. Notes and tags kept.',
    failed ? 'error' : 'success');
}

async function exportBookmarks() {
  try {
    const bookmarks = await listBookmarks();
    const file = new Blob([JSON.stringify({ format: 'linkbook', version: 1, exportedAt: new Date().toISOString(), bookmarks }, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = `linkbook-${new Date().toISOString().slice(0,10)}.json`;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Exported ${bookmarks.length} bookmarks. Keep the JSON file somewhere safe.`, 'success');
  } catch (error) { notify(`Export failed: ${error.message}`, 'error'); }
}
els.importFile.addEventListener('change', async () => {
  const file = els.importFile.files?.[0];
  els.importFile.value = '';
  if (!file) return;
  if (file.size > 100_000_000) { notify('Backup is too large (100 MB maximum).', 'error'); return; }
  try {
    const payload = JSON.parse(await file.text());
    if (payload?.format !== 'linkbook' || payload?.version !== 1 || !Array.isArray(payload.bookmarks)) throw new Error('Not a Linkbook v1 JSON backup.');
    let imported = 0, skipped = 0;
    for (const raw of payload.bookmarks) {
      try {
        const url = normalizeUrl(raw.url);
        if (await getByUrl(url)) { skipped++; continue; }
        const basic = fallbackMetadata(url);
        const record = {
          id: crypto.randomUUID(), url, ...basic,
          title: String(raw.title || basic.title).slice(0,500), description: String(raw.description || '').slice(0,5000),
          image: safeImageUrl(raw.image, url),
          coverMode: ['auto','graphic','custom'].includes(raw.coverMode) ? raw.coverMode : 'auto',
          coverData: isLocalCover(raw.coverData) ? raw.coverData : '',
          customCoverUrl: safeImageUrl(raw.customCoverUrl, url), favicon: safeImageUrl(raw.favicon, url) || basic.favicon,
          siteName: String(raw.siteName || basic.siteName).slice(0,200), author: String(raw.author || '').slice(0,300),
          published: parsePublicationDate(raw.published),
          metadataSource: ['basic', 'page', 'github-api', 'defuddle-api'].includes(raw.metadataSource) ? raw.metadataSource : 'basic',
          contentMarkdown: String(raw.contentMarkdown || '').slice(0, 100_000),
          metadataCheckedAt: String(raw.metadataCheckedAt || ''),
          metadataError: String(raw.metadataError || '').slice(0, 300),
          notes: String(raw.notes || '').slice(0,10000),
          tags: Array.isArray(raw.tags) ? [...new Set(raw.tags.filter(x => typeof x === 'string').map(x => x.trim()).filter(Boolean))].slice(0,30) : [],
          source: 'import', createdAt: !Number.isNaN(Date.parse(raw.createdAt)) ? raw.createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await saveBookmark(record); imported++;
      } catch { skipped++; }
    }
    await reload();
    notify(`Imported ${imported} bookmarks; skipped ${skipped} duplicates or invalid entries.`, 'success');
  } catch (error) { notify(`Import failed: ${error.message}`, 'error'); }
});


// All operational actions live behind one visible command launcher.
function availableCommands() {
  const commands = [
    {label:'Show all tags', detail:'Clear tag filter', run:()=>{state.selectedTag='';render();}},
    ...availableTags().map(tag=>({label:'Filter tag: '+tag, detail:'Only show links tagged '+tag, run:()=>{state.selectedTag=tag;render();}})),
    {label:'Refresh all links with Defuddle', detail:'Update metadata, article text and automatic images', run:refreshAllBookmarks},
    ...(state.refreshing ? [{label:'Stop refreshing links', detail:'Finish the current request, then stop', run:()=>{state.stopRefresh=true;}}] : []),
    {label:'Switch to grid view', detail:'Show bookmarks as cards', run:()=>{state.view='grid';saveView('grid');render();}},
    {label:'Switch to list view', detail:'Show bookmarks as rows', run:()=>{state.view='list';saveView('list');render();}},
    {label:'Export JSON backup', detail:'Download all locally saved bookmarks', run:exportBookmarks},
    {label:'Import JSON backup', detail:'Import bookmarks from a file', run:()=>els.importFile.click()}
  ];
  const selected = state.selectedId && state.bookmarks.find(b=>b.id===state.selectedId);
  if (selected) {
    commands.unshift(
      {label:'Refresh selected link', detail:selected.title || selected.url, run:refreshSelectedBookmark},
      {label:'Edit selected link', detail:selected.title || selected.url, run:()=>openEditor(selected.id)},
      {label:'Delete selected link', detail:'Asks for confirmation', run:deleteSelectedBookmark}
    );
    if (els.dialog.open) {
      commands.unshift({label:'Save bookmark changes', detail:'Save the open details form', run:()=>els.detailForm.requestSubmit()});
    }
    if (selected.contentMarkdown) {
      commands.push({label:'Copy extracted article text', detail:selected.title || selected.url, run:async()=> {
        try {
          await navigator.clipboard.writeText(selected.contentMarkdown);
          notify('Extracted article text copied.', 'success');
        } catch(error) {notify('Copy failed: '+error.message,'error');}
      }});
    }
  }
  const query=els.commandSearch.value.trim().toLowerCase();
  if (query) {
    for (const bookmark of state.bookmarks) {
      const haystack=[bookmark.title,bookmark.url,bookmark.siteName].join(' ').toLowerCase();
      if (!haystack.includes(query)) continue;
      commands.push({
        label:'Edit: '+(bookmark.title || domainOf(bookmark.url)),
        detail:bookmark.url, run:()=>openEditor(bookmark.id)
      });
      commands.push({
        label:'Open: '+(bookmark.title || domainOf(bookmark.url)),
        detail:bookmark.url, run:()=>window.open(bookmark.url,'_blank','noopener')
      });
    }
  }
  return commands.filter(command =>
    !query || (command.label+' '+command.detail).toLowerCase().includes(query)
  ).slice(0,70);
}
let shownCommands=[];
let commandIndex=0;
function renderCommands() {
  shownCommands=availableCommands();
  els.commandResults.replaceChildren();
  const nodes=shownCommands.map((command,index)=>{
    const option=document.createElement('button');
    option.type='button';
    option.className='command-option'+(index===commandIndex?' active':'');
    option.dataset.index=String(index);
    const title=document.createElement('strong');
    title.textContent=command.label;
    const description=document.createElement('small');
    description.textContent=command.detail;
    option.append(title,description);
    return option;
  });
  els.commandResults.append(...nodes);
  if (!nodes.length) els.commandResults.textContent='No matching commands.';
  if (commandIndex>=shownCommands.length) commandIndex=0;
  for(const node of els.commandResults.children) {
    node.classList?.toggle('active',Number(node.dataset.index)===commandIndex);
  }
}
function openCommands() {
  if (els.commandsDialog.open) return;
  els.commandSearch.value='';
  commandIndex=0;
  renderCommands();
  els.commandsDialog.showModal();
  els.commandSearch.focus();
}
function runCommand(index) {
  const command=shownCommands[index];
  if (!command) return;
  els.commandsDialog.close();
  try {
    const result = command.run(); // Keep file picker / new-tab actions in user activation.
    if (result && typeof result.catch === 'function') result.catch(error=>notify('Command failed: '+error.message,'error'));
  } catch (error) { notify('Command failed: '+error.message,'error'); }
}
els.commandsButton.addEventListener('click',openCommands);
els.commandSearch.addEventListener('input',()=>{commandIndex=0;renderCommands();});
els.commandSearch.addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'||event.key==='ArrowUp') {
    event.preventDefault();
    if (!shownCommands.length) return;
    commandIndex=(commandIndex+(event.key==='ArrowDown'?1:-1)+shownCommands.length)%shownCommands.length;
    renderCommands();
  }else if(event.key==='Enter') {
    event.preventDefault();
    runCommand(commandIndex);
  }
});
els.commandResults.addEventListener('click',event=>{
  const option=event.target.closest('button[data-index]');
  if(option)runCommand(Number(option.dataset.index));
});
els.commandsDialog.addEventListener('click',event=>{
  if(event.target===els.commandsDialog)els.commandsDialog.close();
});
document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k') {
    event.preventDefault();
    openCommands();
  }else if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&els.dialog.open&&!els.commandsDialog.open) {
    event.preventDefault();
    els.detailForm.requestSubmit();
  }
});

async function processShareTarget() {
  const params = new URLSearchParams(window.location.search);
  if (!['url','text','title'].some(key => params.has(key))) return;
  const payload = { url: params.get('url') || '', text: params.get('text') || '', title: params.get('title') || '' };
  // Clear the query before await so the same share is not resaved after reload.
  history.replaceState({}, '', window.location.pathname + window.location.hash);
  const url = urlFromShare(payload);
  if (!url) { notify('The shared item did not contain a supported http(s) link.', 'error'); return; }
  const shareTitle = /^https?:\/\//i.test(payload.title.trim()) ? '' : payload.title;
  try { await createBookmark(url, shareTitle); }
  catch (error) { notify(`Could not save shared link: ${error.message}`, 'error'); }
}

async function initialize() {
  try { await reload(); await processShareTarget(); }
  catch (error) { notify(`Local storage unavailable: ${error.message}. Check browser settings.`, 'error'); els.url.disabled = true; }
  // Retire this prototype's former PWA worker only. Other apps on the
  // same GitHub Pages origin, including the Testlab gallery, are untouched.
  if ('serviceWorker' in navigator) {
    const retiredScope = new URL('./', import.meta.url).href;
    navigator.serviceWorker.getRegistrations()
      .then(regs => Promise.all(regs.filter(reg => reg.scope === retiredScope).map(reg => reg.unregister())))
      .catch(error => console.warn('Legacy Linkbook worker cleanup skipped:', error));
  }
  if ('caches' in window) {
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('testlab-linkbook-')).map(key => caches.delete(key))
    )).catch(() => {});
  }
}
initialize();

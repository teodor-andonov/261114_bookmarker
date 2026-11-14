import { listBookmarks, getBookmark, getByUrl, saveBookmark, deleteBookmark } from './db.js';
import { normalizeUrl, safeImageUrl, fallbackMetadata, getMetadata, urlFromShare, parsePublicationDate } from './metadata.js';

const $ = id => document.getElementById(id);
const els = {
  addForm: $('addForm'), url: $('urlInput'), addButton: $('addButton'), message: $('message'),
  count: $('totalCount'), search: $('searchInput'), sort: $('sortSelect'), tags: $('tagFilters'),
  list: $('bookmarkList'), empty: $('emptyState'), emptyTitle: $('emptyTitle'), emptyDescription: $('emptyDescription'),
  gridButton: $('gridButton'), listButton: $('listButton'), exportButton: $('exportButton'), importButton: $('importButton'), importFile: $('importFile'),
  dialog: $('detailDialog'), detailForm: $('detailForm'), closeDialog: $('closeDialog'), deleteButton: $('deleteButton'),
  refreshButton: $('refreshButton'), metadataStatus: $('detailMetadataStatus')
};

const state = { bookmarks: [], view: getSavedView(), selectedTag: '', selectedId: null, loading: false };

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
    return [b.url, b.title, b.description, b.siteName, b.author, b.notes, ...(b.tags || [])].some(v => String(v || '').toLocaleLowerCase().includes(needle));
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

const editIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16 4a2 2 0 0 1 3 3L9 17l-4 1 1-4L16 4Z"/></svg>';
const externalIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M20 13v7H4V4h7"/></svg>';

function cardHtml(b) {
  const domain = domainOf(b.url);
  const image = safeImageUrl(b.image, b.url);
  const icon = safeImageUrl(b.favicon, b.url);
  const preview = image ? `<img class="preview-image" src="${escapeHtml(image)}" loading="lazy" referrerpolicy="no-referrer" alt="" />` : '';
  const favicon = icon ? `<img class="favicon" src="${escapeHtml(icon)}" loading="lazy" referrerpolicy="no-referrer" alt="" />` : '<span class="favicon is-hidden"></span>';
  const tags = (b.tags || []).slice(0, 3).map(tag => `<span class="inline-tag">${escapeHtml(tag)}</span>`).join('');
  return `<article class="bookmark-card" data-id="${escapeHtml(b.id)}">
    <div class="preview"><div class="preview-art"><span class="preview-letter">${escapeHtml((domain[0] || 'L').toUpperCase())}</span></div>${preview}</div>
    <div class="bookmark-body">
      <div class="bookmark-meta">${favicon}<span class="favicon-fallback">${escapeHtml((domain[0] || 'L').toUpperCase())}</span><span class="domain" title="${escapeHtml(domain)}">${escapeHtml(b.siteName || domain)}</span></div>
      <h3 title="${escapeHtml(b.title)}">${escapeHtml(b.title || domain)}</h3>
      <p class="description">${escapeHtml(b.description || 'No description available')}</p>
      ${tags ? `<div class="inline-tags">${tags}</div>` : ''}
      <div class="bookmark-foot"><span class="date-added">${escapeHtml(displayDate(b.createdAt))}</span><div class="card-actions"><button type="button" class="tiny-action" data-action="edit" title="Edit bookmark" aria-label="Edit ${escapeHtml(b.title)}">${editIcon}</button><a class="tiny-action" href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer" title="Open page" aria-label="Open ${escapeHtml(b.title)}">${externalIcon}</a></div></div>
    </div>
  </article>`;
}

function renderTags() {
  const totals = new Map();
  for (const bookmark of state.bookmarks) for (const tag of bookmark.tags || []) totals.set(tag, (totals.get(tag) || 0) + 1);
  if (state.selectedTag && !totals.has(state.selectedTag)) state.selectedTag = '';
  const items = [...totals].sort(([a], [b]) => a.localeCompare(b));
  els.tags.innerHTML = items.length ? `<button class="tag-filter ${state.selectedTag === '' ? 'selected' : ''}" type="button" data-tag="">All <span class="tag-count">${state.bookmarks.length}</span></button>` + items.map(([tag,count]) => `<button type="button" class="tag-filter ${state.selectedTag === tag ? 'selected' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)} <span class="tag-count">${count}</span></button>`).join('') : '';
}

function render() {
  els.count.textContent = String(state.bookmarks.length);
  renderTags();
  const bookmarks = filteredBookmarks();
  els.list.className = state.view === 'list' ? 'bookmark-grid list-view' : 'bookmark-grid';
  els.gridButton.classList.toggle('active', state.view === 'grid');
  els.listButton.classList.toggle('active', state.view === 'list');
  els.gridButton.setAttribute('aria-pressed', String(state.view === 'grid'));
  els.listButton.setAttribute('aria-pressed', String(state.view === 'list'));
  els.list.innerHTML = bookmarks.map(cardHtml).join('');
  els.empty.hidden = bookmarks.length !== 0;
  if (state.bookmarks.length === 0) {
    els.emptyTitle.textContent = 'Nothing saved yet.';
    els.emptyDescription.textContent = 'Paste a URL above or share a link from Android to start collecting.';
  } else {
    els.emptyTitle.textContent = 'No matching bookmarks.';
    els.emptyDescription.textContent = 'Try another search or tag filter.';
  }
}

async function enrichBookmark(bookmark, sharedTitle) {
  try {
    const enriched = await getMetadata(bookmark.url, sharedTitle);
    if (enriched.metadataSource === 'basic') return;
    const current = await getBookmark(bookmark.id);
    if (!current || current.updatedAt !== bookmark.updatedAt) return; // Never overwrite a newer user edit.
    await saveBookmark({ ...current, ...enriched });
    await reload();
    notify('Saved locally with page metadata.', 'success');
  } catch (error) {
    console.warn('Optional metadata extraction failed:', error);
  }
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
  notify('Saved locally. Additional metadata is best effort; you can edit details at any time.', 'success');
  // Save first; attempt metadata enrichment without blocking the Add button.
  void enrichBookmark(bookmark, sharedTitle);
  return true;
}

function formControl(name) { return els.detailForm.elements.namedItem(name); }
function fillEditor(bookmark) {
  state.selectedId = bookmark.id;
  for (const name of ['title', 'url', 'description', 'author', 'published', 'image', 'notes']) formControl(name).value = bookmark[name] || '';
  formControl('tags').value = (bookmark.tags || []).join(', ');
  els.metadataStatus.textContent = bookmark.metadataSource === 'basic'
    ? 'Limited preview: the page may block direct browser access. You can add a title, description or image URL manually.'
    : `Metadata source: ${bookmark.metadataSource === 'github-api' ? 'GitHub public API' : 'page HTML'}. Saved only in this browser.`;
}
async function openEditor(id) {
  try {
    const bookmark = await getBookmark(id);
    if (!bookmark) return;
    fillEditor(bookmark);
    if (!els.dialog.open) els.dialog.showModal();
  } catch (error) { notify(error.message, 'error'); }
}

els.addForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (state.loading) return;
  state.loading = true; els.addButton.disabled = true;
  try { const saved = await createBookmark(els.url.value); if (saved) els.url.value = ''; }
  catch (error) { notify(error.message || 'Unable to save this link.', 'error'); }
  finally { state.loading = false; els.addButton.disabled = false; }
});

els.list.addEventListener('click', event => {
  const button = event.target.closest('button[data-action="edit"]');
  if (!button) return;
  const id = button.closest('.bookmark-card')?.dataset.id;
  if (id) openEditor(id);
});
els.list.addEventListener('error', event => {
  if (event.target instanceof HTMLImageElement) event.target.classList.add('is-hidden');
}, true);
els.tags.addEventListener('click', event => {
  const button = event.target.closest('button[data-tag]');
  if (!button) return;
  state.selectedTag = button.dataset.tag || '';
  render();
});
els.search.addEventListener('input', render);
els.sort.addEventListener('change', render);
for (const [view, button] of [['grid', els.gridButton], ['list', els.listButton]]) {
  button.addEventListener('click', () => { state.view = view; saveView(view); render(); });
}
els.closeDialog.addEventListener('click', () => els.dialog.close());
els.dialog.addEventListener('click', event => { if (event.target === els.dialog) els.dialog.close(); });

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
    const saved = {
      ...current, url, title: formControl('title').value.trim().slice(0, 500),
      description: formControl('description').value.trim().slice(0, 5000),
      author: formControl('author').value.trim().slice(0, 300),
      published: parsePublicationDate(formControl('published').value),
      image: safeImageUrl(formControl('image').value, url),
      tags, notes: formControl('notes').value.slice(0, 10000), updatedAt: new Date().toISOString()
    };
    if (!saved.title) throw new Error('Title cannot be empty.');
    await saveBookmark(saved);
    els.dialog.close();
    await reload();
    notify('Bookmark updated.', 'success');
  } catch (error) { notify(error.message, 'error'); els.metadataStatus.textContent = error.message; }
});

els.deleteButton.addEventListener('click', async () => {
  if (!state.selectedId || !confirm('Delete this bookmark from this browser?')) return;
  try { await deleteBookmark(state.selectedId); els.dialog.close(); await reload(); notify('Bookmark deleted.', 'success'); }
  catch (error) { notify(error.message, 'error'); }
});

els.refreshButton.addEventListener('click', async () => {
  const id = state.selectedId;
  if (!id) return;
  els.refreshButton.disabled = true;
  els.metadataStatus.textContent = 'Trying direct browser access…';
  try {
    const current = await getBookmark(id);
    if (!current) return;
    const result = await getMetadata(current.url);
    if (result.metadataSource === 'basic') {
      els.metadataStatus.textContent = 'No additional metadata available (often due to website CORS restrictions).';
      return;
    }
    // The refresh button deliberately re-fetches page fields, retaining local notes/tags.
    const updated = { ...current, ...result, updatedAt: new Date().toISOString() };
    await saveBookmark(updated); fillEditor(updated); await reload();
    notify('Metadata refreshed.', 'success');
  } catch (error) { els.metadataStatus.textContent = error.message; }
  finally { els.refreshButton.disabled = false; }
});

els.exportButton.addEventListener('click', async () => {
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
});
els.importButton.addEventListener('click', () => els.importFile.click());
els.importFile.addEventListener('change', async () => {
  const file = els.importFile.files?.[0];
  els.importFile.value = '';
  if (!file) return;
  if (file.size > 20_000_000) { notify('Backup is too large (20 MB maximum).', 'error'); return; }
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
          image: safeImageUrl(raw.image, url), favicon: safeImageUrl(raw.favicon, url) || basic.favicon,
          siteName: String(raw.siteName || basic.siteName).slice(0,200), author: String(raw.author || '').slice(0,300),
          published: parsePublicationDate(raw.published),
          metadataSource: ['basic', 'page', 'github-api'].includes(raw.metadataSource) ? raw.metadataSource : 'basic',
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
  catch (error) { notify(`Local storage unavailable: ${error.message}. Check browser settings.`, 'error'); els.addButton.disabled = true; }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Offline support unavailable:', error));
  }
}
initialize();

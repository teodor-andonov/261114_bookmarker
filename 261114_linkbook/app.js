import { listBookmarks, getBookmark, getByUrl, saveBookmark, deleteBookmark } from './db.js';
import { normalizeUrl, safeImageUrl, fallbackMetadata, getMetadata, urlFromShare, parsePublicationDate } from './metadata.js';
import { coverIdentity, coverImage, isLocalCover } from './cover.js';

const $ = id => document.getElementById(id);
const els = {
  addForm: $('addForm'), url: $('urlInput'), message: $('message'),
  count: $('totalCount'), search: $('searchInput'), sort: $('sortSelect'), tags: $('tagFilters'),
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
  const cover = coverIdentity(bookmark);
  const photo = coverImage(bookmark);
  const icon = safeImageUrl(bookmark.favicon, bookmark.url);
  const favicon = icon ? `<img class="simple-cover-favicon" src="${escapeHtml(icon)}" loading="lazy" referrerpolicy="no-referrer" alt="" />` : '';
  return `<div class="preview" aria-label="Cover for ${escapeHtml(cover.title)}">
    <div class="preview-art simple-cover">
      <div class="simple-cover-identity">
        <div class="simple-cover-icon">
          ${favicon}<span class="simple-cover-favicon-fallback" aria-hidden="true">${escapeHtml((cover.host[0] || 'L').toUpperCase())}</span>
        </div>
        <span class="simple-cover-domain" title="${escapeHtml(cover.host)}">${escapeHtml(cover.host)}</span>
      </div>
      <div class="simple-cover-title">${escapeHtml(cover.title)}</div>
    </div>
    ${photo ? `<img class="preview-image" src="${escapeHtml(photo)}" loading="lazy" referrerpolicy="no-referrer" alt="" />` : ''}
  </div>`;
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
    await saveBookmark({...current, metadataError: enriched.metadataError || 'Metadata unavailable', metadataCheckedAt: enriched.metadataCheckedAt});
    await reload();
    notify('Link saved. Metadata unavailable: ' + (enriched.metadataError || 'No article found'), 'error');
    return;
  }
  await saveBookmark({ ...current, ...enriched, updatedAt: new Date().toISOString() });
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
  void enrichBookmark(bookmark, sharedTitle);
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
for (const field of ['title', 'coverMode', 'customCoverUrl']) {
  formControl(field).addEventListener('input', updateCoverPreview);
}
els.coverUpload.addEventListener('change', async () => {
  const file = els.coverUpload.files?.[0];
  if (!file) return;
  try {
    els.metadataStatus.textContent = 'Optimising image locally…';
    state.coverUploadData = await resizeCover(file);
    formControl('coverMode').value = 'custom';
    els.metadataStatus.textContent = 'Custom cover ready. Save changes to keep it with this bookmark.';
    updateCoverPreview();
  } catch (error) { els.metadataStatus.textContent = error.message; }
  finally { els.coverUpload.value = ''; }
});
els.clearCover.addEventListener('click', () => {
  state.coverUploadData = '';
  formControl('customCoverUrl').value = '';
  formControl('coverMode').value = 'graphic';
  els.metadataStatus.textContent = 'Custom cover cleared. The simple cover will be used when you save.';
  updateCoverPreview();
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
    const saved = {
      ...current, url, title: formControl('title').value.trim().slice(0, 500),
      description: formControl('description').value.trim().slice(0, 5000),
      author: formControl('author').value.trim().slice(0, 300),
      published: parsePublicationDate(formControl('published').value),
      image: safeImageUrl(formControl('image').value, url),
      coverMode: formControl('coverMode').value,
      coverData: isLocalCover(state.coverUploadData) ? state.coverUploadData : '',
      customCoverUrl: safeImageUrl(formControl('customCoverUrl').value, url),
      tags, notes: formControl('notes').value.slice(0, 10000), updatedAt: new Date().toISOString()
    };
    if (!saved.title) throw new Error('Title cannot be empty.');
    if (saved.coverMode === 'custom' && !saved.coverData && !saved.customCoverUrl) throw new Error('For a custom cover, upload an image or enter an image URL.');
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
  els.metadataStatus.textContent = 'Fetching metadata via Defuddle…';
  try {
    const current = await getBookmark(id);
    if (!current) return;
    const result = await getMetadata(current.url);
    if (result.metadataSource === 'basic') {
      els.metadataStatus.textContent = 'Defuddle could not provide metadata (page unavailable, blocked or API limit reached).';
      return;
    }
    // The refresh button deliberately re-fetches page fields, retaining local notes/tags.
    const updated = { ...current, ...result, image: result.image || current.image || '', favicon: current.favicon || result.favicon, updatedAt: new Date().toISOString() };
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

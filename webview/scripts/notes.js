/* ============================================================
   AI Builder Workspace — Notes Module
   
   Pinnable notes with search, basic markdown rendering,
   chronological sorting (pinned first), and full CRUD.
   ============================================================ */

const Notes = (() => {
  // ── State ─────────────────────────────────────────────────
  let notes = [];
  let searchText = '';

  // ── Container ─────────────────────────────────────────────
  function getContainer() {
    return document.getElementById('tab-notes');
  }

  // ── Filtering & Sorting ───────────────────────────────────
  function getFilteredNotes() {
    let result = [...notes];

    // Search filter
    if (searchText) {
      const q = searchText.toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
      );
    }

    // Sort: pinned first, then by updatedAt descending
    result.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    return result;
  }

  // ── Basic Markdown Rendering ──────────────────────────────
  function renderMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);

    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic: *text*
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Inline code: `code`
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    // List items: lines starting with "- "
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    // Wrap consecutive <li> in <ul>
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

    // Newlines to <br> (but not inside <ul>)
    html = html.replace(/\n/g, '<br>');
    // Clean up <br> right after </ul> or before <ul>
    html = html.replace(/<br><ul>/g, '<ul>');
    html = html.replace(/<\/ul><br>/g, '</ul>');

    return html;
  }

  // ── Truncate ──────────────────────────────────────────────
  function truncate(str, len = 160) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
  }

  // ── Render ────────────────────────────────────────────────
  function render() {
    const container = getContainer();
    if (!container) return;

    const filtered = getFilteredNotes();
    const pinnedCount = notes.filter(n => n.pinned).length;

    container.innerHTML = `
      <!-- Header -->
      <div class="section-header">
        <div>
          <span class="section-title">Notes</span>
          ${pinnedCount > 0 ? `<span class="text-muted text-small" style="margin-left:6px;">📌 ${pinnedCount} pinned</span>` : ''}
        </div>
        <button class="btn btn-primary btn-sm" id="notes-add-btn" title="Add Note">+ Add</button>
      </div>

      <!-- Search -->
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input class="input-field" type="text" id="notes-search"
               placeholder="Search notes…"
               value="${escapeHtml(searchText)}" />
      </div>

      <!-- Notes List -->
      <div id="notes-list">
        ${filtered.length === 0 ? renderEmptyState() : filtered.map((n, i) => renderCard(n, i)).join('')}
      </div>
    `;

    // ── Event Listeners ──
    container.querySelector('#notes-add-btn').addEventListener('click', () => openModal());

    container.querySelector('#notes-search').addEventListener('input', e => {
      searchText = e.target.value;
      render();
    });

    // Card actions
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'pin')    togglePin(id);
        if (action === 'edit')   openModal(id);
        if (action === 'delete') deleteNote(id);
      });
    });

    // Empty state add button
    const emptyAdd = container.querySelector('#notes-empty-add');
    if (emptyAdd) emptyAdd.addEventListener('click', () => openModal());
  }

  // ── Render Single Card ────────────────────────────────────
  function renderCard(note, index) {
    const noteId = escapeHtml(note.id);
    return `
      <div class="card" style="animation-delay: ${index * 40}ms">
        <div class="card-header">
          <div class="flex items-center gap-4" style="flex:1; min-width:0;">
            ${note.pinned ? '<span class="pinned-indicator"></span>' : ''}
            <span class="card-title">${escapeHtml(note.title)}</span>
          </div>
          <div class="item-actions">
            <button class="btn-icon" data-action="pin" data-id="${noteId}"
                    title="${note.pinned ? 'Unpin' : 'Pin'}"
                    style="${note.pinned ? 'color: var(--vscode-terminal-ansiYellow, #e5c07b);' : ''}">
              ${note.pinned ? '📌' : '📍'}
            </button>
            <button class="btn-icon" data-action="edit" data-id="${noteId}" title="Edit">✏️</button>
            <button class="btn-icon btn-icon-danger" data-action="delete" data-id="${noteId}" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="card-body note-content">
          ${renderMarkdown(truncate(note.content, 200))}
        </div>
        <div class="card-footer">
          <span class="timestamp">${formatDate(note.updatedAt || note.createdAt)}</span>
        </div>
      </div>
    `;
  }

  // ── Empty State ───────────────────────────────────────────
  function renderEmptyState() {
    return `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-title">No notes yet</div>
        <div class="empty-description">
          Jot down ideas, decisions, or code snippets. Pin important notes to keep them at the top.
        </div>
        <button class="btn btn-primary btn-sm" id="notes-empty-add">+ Create Your First Note</button>
      </div>
    `;
  }

  // ── Modal: Add / Edit ─────────────────────────────────────
  function openModal(noteId = null) {
    const existing = noteId ? notes.find(n => n.id === noteId) : null;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">${existing ? 'Edit Note' : 'New Note'}</span>
          <button class="modal-close" id="note-modal-close">&times;</button>
        </div>

        <div class="form-group">
          <label for="note-title">Title</label>
          <input class="input-field" type="text" id="note-title"
                 placeholder="e.g. Architecture decisions"
                 value="${existing ? escapeHtml(existing.title) : ''}" />
        </div>

        <div class="form-group">
          <label for="note-content">Content</label>
          <textarea class="textarea-field" id="note-content" rows="8"
                    placeholder="Write your note… Supports **bold**, *italic*, \`code\`, and - list items."
          >${existing ? escapeHtml(existing.content) : ''}</textarea>
          <div class="text-muted text-small mt-4">
            Supports: <strong>**bold**</strong>, <em>*italic*</em>, <code>\`code\`</code>, - lists
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" id="note-modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="note-modal-save">${existing ? 'Update' : 'Create'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#note-modal-close').addEventListener('click', close);
    overlay.querySelector('#note-modal-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    overlay.querySelector('#note-modal-save').addEventListener('click', () => {
      const title = overlay.querySelector('#note-title').value.trim();
      const content = overlay.querySelector('#note-content').value.trim();

      if (!title) {
        showToast('Please enter a title', 'warning');
        return;
      }

      if (existing) {
        existing.title = title;
        existing.content = content;
        existing.updatedAt = new Date().toISOString();
        showToast('Note updated', 'success');
      } else {
        const now = new Date().toISOString();
        notes.push({
          id: generateId(),
          title,
          content,
          pinned: false,
          createdAt: now,
          updatedAt: now,
        });
        showToast('Note created', 'success');
      }

      saveNotes();
      render();
      close();
    });

    setTimeout(() => overlay.querySelector('#note-title').focus(), 100);
  }

  // ── Toggle Pin ────────────────────────────────────────────
  function togglePin(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    note.pinned = !note.pinned;
    saveNotes();
    render();
    showToast(note.pinned ? 'Note pinned' : 'Note unpinned', 'info');
  }

  // ── Delete Note ───────────────────────────────────────────
  function deleteNote(id) {
    notes = notes.filter(n => n.id !== id);
    saveNotes();
    render();
    showToast('Note deleted', 'info');
  }

  // ── Persist ───────────────────────────────────────────────
  function saveNotes() {
    vscode.postMessage({ command: 'saveData', key: 'notes', data: notes });
  }

  // ── Public API ────────────────────────────────────────────
  return {
    init() {
      render();
    },

    render,

    handleData(data) {
      if (Array.isArray(data)) {
        notes = data;
      }
      render();
    },
  };
})();

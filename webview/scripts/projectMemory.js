/* ============================================================
   AI Builder Workspace — Project Memory Module
   
   Stores project context as key-value entries with categories.
   Features: workspace info display, copy-all, category filter,
   and full CRUD via modal forms.
   ============================================================ */

const ProjectMemory = (() => {
  // ── State ─────────────────────────────────────────────────
  let entries = [];
  let workspaceInfo = null; // { name, folderCount }
  let filterCategory = 'all';

  // ── Category Definitions ──────────────────────────────────
  const CATEGORIES = [
    { key: 'all',           label: 'All' },
    { key: 'architecture',  label: 'Architecture' },
    { key: 'dependencies',  label: 'Dependencies' },
    { key: 'conventions',   label: 'Conventions' },
    { key: 'api',           label: 'API Info' },
    { key: 'notes',         label: 'Notes' },
  ];

  const CATEGORY_BADGE_CLASS = {
    architecture: 'badge-codegen',
    dependencies: 'badge-debug',
    conventions:  'badge-refactor',
    api:          'badge-explain',
    notes:        'badge-custom',
  };

  // ── Container ─────────────────────────────────────────────
  function getContainer() {
    return document.getElementById('tab-memory');
  }

  // ── Filtering ─────────────────────────────────────────────
  function getFilteredEntries() {
    if (filterCategory === 'all') return entries;
    return entries.filter(e => e.category === filterCategory);
  }

  // ── Format All Entries as Text ────────────────────────────
  function formatAllEntries() {
    const grouped = {};
    CATEGORIES.filter(c => c.key !== 'all').forEach(c => { grouped[c.key] = []; });

    entries.forEach(e => {
      if (grouped[e.category]) {
        grouped[e.category].push(e);
      } else {
        if (!grouped['notes']) grouped['notes'] = [];
        grouped['notes'].push(e);
      }
    });

    let text = '## Project Context\n\n';
    CATEGORIES.filter(c => c.key !== 'all').forEach(c => {
      const items = grouped[c.key];
      if (items && items.length > 0) {
        text += `### ${c.label}\n`;
        items.forEach(item => {
          text += `- **${item.key}**: ${item.value}\n`;
        });
        text += '\n';
      }
    });

    return text.trim();
  }

  // ── Render ────────────────────────────────────────────────
  function render() {
    const container = getContainer();
    if (!container) return;

    const filtered = getFilteredEntries();

    container.innerHTML = `
      <!-- Workspace Info Card -->
      ${renderWorkspaceCard()}

      <!-- Header -->
      <div class="section-header">
        <span class="section-title">Project Memory</span>
        <div class="item-actions">
          ${entries.length > 0 ? `<button class="btn btn-secondary btn-sm" id="memory-copy-all" title="Copy all context">📋 Copy All</button>` : ''}
          <button class="btn btn-primary btn-sm" id="memory-add-btn" title="Add Entry">+ Add</button>
        </div>
      </div>

      <!-- Category Filters -->
      <div class="filter-row" id="memory-filters">
        ${CATEGORIES.map(c => `
          <button class="filter-btn ${filterCategory === c.key ? 'active' : ''}"
                  data-category="${c.key}">
            ${c.label}
          </button>
        `).join('')}
      </div>

      <!-- Entry Cards -->
      <div id="memory-list">
        ${filtered.length === 0 ? renderEmptyState() : filtered.map((e, i) => renderCard(e, i)).join('')}
      </div>
    `;

    // ── Event Listeners ──
    container.querySelector('#memory-add-btn').addEventListener('click', () => openModal());

    const copyAllBtn = container.querySelector('#memory-copy-all');
    if (copyAllBtn) {
      copyAllBtn.addEventListener('click', copyAll);
    }

    // Category filters
    container.querySelectorAll('#memory-filters .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterCategory = btn.dataset.category;
        render();
      });
    });

    // Card actions
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'edit')   openModal(id);
        if (action === 'delete') deleteEntry(id);
      });
    });

    // Empty state add
    const emptyAdd = container.querySelector('#memory-empty-add');
    if (emptyAdd) emptyAdd.addEventListener('click', () => openModal());
  }

  // ── Workspace Info Card ───────────────────────────────────
  function renderWorkspaceCard() {
    if (!workspaceInfo) {
      return `
        <div class="workspace-card" style="opacity: 0.6;">
          <span class="workspace-icon">📂</span>
          <div>
            <div class="workspace-name">Loading workspace…</div>
            <div class="workspace-meta">Fetching workspace information</div>
          </div>
        </div>
      `;
    }

    return `
      <div class="workspace-card">
        <span class="workspace-icon">📂</span>
        <div>
          <div class="workspace-name">${escapeHtml(workspaceInfo.name || 'Workspace')}</div>
          <div class="workspace-meta">${workspaceInfo.folderCount || 0} folder${(workspaceInfo.folderCount || 0) !== 1 ? 's' : ''} in workspace</div>
        </div>
      </div>
    `;
  }

  // ── Render Single Card ────────────────────────────────────
  function renderCard(entry, index) {
    const badgeClass = CATEGORY_BADGE_CLASS[entry.category] || 'badge-custom';
    const categoryLabel = CATEGORIES.find(c => c.key === entry.category)?.label || entry.category;
    const entryId = escapeHtml(entry.id);

    return `
      <div class="card" style="animation-delay: ${index * 40}ms">
        <div class="card-header">
          <span class="card-title">${escapeHtml(entry.key)}</span>
          <div class="item-actions">
            <button class="btn-icon" data-action="edit" data-id="${entryId}" title="Edit">✏️</button>
            <button class="btn-icon btn-icon-danger" data-action="delete" data-id="${entryId}" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="card-body">${escapeHtml(entry.value)}</div>
        <div class="card-footer">
          <span class="badge ${badgeClass}">${escapeHtml(categoryLabel)}</span>
        </div>
      </div>
    `;
  }

  // ── Empty State ───────────────────────────────────────────
  function renderEmptyState() {
    return `
      <div class="empty-state">
        <div class="empty-icon">🧠</div>
        <div class="empty-title">No context entries</div>
        <div class="empty-description">
          Store important project context — architecture decisions, dependencies, conventions — for quick reference.
        </div>
        <button class="btn btn-primary btn-sm" id="memory-empty-add">+ Add Context Entry</button>
      </div>
    `;
  }

  // ── Modal: Add / Edit ─────────────────────────────────────
  function openModal(entryId = null) {
    const existing = entryId ? entries.find(e => e.id === entryId) : null;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">${existing ? 'Edit Entry' : 'New Context Entry'}</span>
          <button class="modal-close" id="memory-modal-close">&times;</button>
        </div>

        <div class="form-group">
          <label for="memory-key">Key</label>
          <input class="input-field" type="text" id="memory-key"
                 placeholder="e.g. Database, Auth Provider, Coding Style"
                 value="${existing ? escapeHtml(existing.key) : ''}" />
        </div>

        <div class="form-group">
          <label for="memory-value">Value</label>
          <textarea class="textarea-field" id="memory-value" rows="4"
                    placeholder="Describe the context…"
          >${existing ? escapeHtml(existing.value) : ''}</textarea>
        </div>

        <div class="form-group">
          <label for="memory-category">Category</label>
          <select class="select-field" id="memory-category">
            ${CATEGORIES.filter(c => c.key !== 'all').map(c => `
              <option value="${c.key}" ${existing && existing.category === c.key ? 'selected' : ''}>
                ${c.label}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" id="memory-modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="memory-modal-save">${existing ? 'Update' : 'Create'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#memory-modal-close').addEventListener('click', close);
    overlay.querySelector('#memory-modal-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    overlay.querySelector('#memory-modal-save').addEventListener('click', () => {
      const key = overlay.querySelector('#memory-key').value.trim();
      const value = overlay.querySelector('#memory-value').value.trim();
      const category = overlay.querySelector('#memory-category').value;

      if (!key) {
        showToast('Please enter a key', 'warning');
        return;
      }
      if (!value) {
        showToast('Please enter a value', 'warning');
        return;
      }

      if (existing) {
        existing.key = key;
        existing.value = value;
        existing.category = category;
        showToast('Entry updated', 'success');
      } else {
        entries.push({
          id: generateId(),
          key,
          value,
          category,
        });
        showToast('Entry created', 'success');
      }

      saveEntries();
      render();
      close();
    });

    setTimeout(() => overlay.querySelector('#memory-key').focus(), 100);
  }

  // ── Copy All ──────────────────────────────────────────────
  function copyAll() {
    const text = formatAllEntries();
    if (!text || text === '## Project Context') {
      showToast('No entries to copy', 'warning');
      return;
    }
    vscode.postMessage({ command: 'copyToClipboard', text });
    showToast('All context copied to clipboard!', 'success');
  }

  // ── Delete Entry ──────────────────────────────────────────
  function deleteEntry(id) {
    entries = entries.filter(e => e.id !== id);
    saveEntries();
    render();
    showToast('Entry deleted', 'info');
  }

  // ── Persist ───────────────────────────────────────────────
  function saveEntries() {
    vscode.postMessage({ command: 'saveData', key: 'projectMemory', data: entries });
  }

  // ── Public API ────────────────────────────────────────────
  return {
    init() {
      // Request workspace info
      vscode.postMessage({ command: 'getWorkspaceInfo' });
      render();
    },

    render,

    handleData(data) {
      if (Array.isArray(data)) {
        entries = data;
      }
      render();
    },

    handleWorkspaceInfo(info) {
      workspaceInfo = info;
      render();
    },
  };
})();

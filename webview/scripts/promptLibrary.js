/* ============================================================
   AI Builder Workspace — Prompt Library Module
   
   Manages reusable AI prompt templates with categories,
   search/filter, CRUD, copy-to-clipboard, and template
   variable highlighting ({{variable}}).
   ============================================================ */

const PromptLibrary = (() => {
  // ── State ─────────────────────────────────────────────────
  let prompts = [];
  let filterCategory = 'all';
  let searchText = '';
  let editingId = null; // null = adding, string = editing

  // ── Category Definitions ──────────────────────────────────
  const CATEGORIES = [
    { key: 'all',      label: 'All' },
    { key: 'codegen',  label: 'Code Gen' },
    { key: 'debug',    label: 'Debug' },
    { key: 'refactor', label: 'Refactor' },
    { key: 'explain',  label: 'Explain' },
    { key: 'custom',   label: 'Custom' },
  ];

  const CATEGORY_BADGE_CLASS = {
    codegen:  'badge-codegen',
    debug:    'badge-debug',
    refactor: 'badge-refactor',
    explain:  'badge-explain',
    custom:   'badge-custom',
  };

  // ── Container ─────────────────────────────────────────────
  function getContainer() {
    return document.getElementById('tab-prompts');
  }

  // ── Filtering Logic ───────────────────────────────────────
  function getFilteredPrompts() {
    return prompts.filter(p => {
      // Category filter
      if (filterCategory !== 'all' && p.category !== filterCategory) return false;
      // Search filter
      if (searchText) {
        const q = searchText.toLowerCase();
        return (p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q));
      }
      return true;
    });
  }

  // ── Template Variable Highlighting ────────────────────────
  function highlightVars(text) {
    return escapeHtml(text).replace(
      /\{\{(\w+)\}\}/g,
      '<span class="template-var">{{$1}}</span>'
    );
  }

  // ── Truncate Content ──────────────────────────────────────
  function truncate(str, len = 120) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
  }

  // ── Render ────────────────────────────────────────────────
  function render() {
    const container = getContainer();
    if (!container) return;

    const filtered = getFilteredPrompts();

    container.innerHTML = `
      <!-- Header -->
      <div class="section-header">
        <span class="section-title">Prompt Library</span>
        <button class="btn btn-primary btn-sm" id="prompts-add-btn" title="Add Prompt">+ Add</button>
      </div>

      <!-- Search -->
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input class="input-field" type="text" id="prompts-search"
               placeholder="Search prompts…"
               value="${escapeHtml(searchText)}" />
      </div>

      <!-- Category Filters -->
      <div class="filter-row" id="prompts-filters">
        ${CATEGORIES.map(c => `
          <button class="filter-btn ${filterCategory === c.key ? 'active' : ''}"
                  data-category="${c.key}">
            ${c.label}
          </button>
        `).join('')}
      </div>

      <!-- Prompt Cards -->
      <div id="prompts-list">
        ${filtered.length === 0 ? renderEmptyState() : filtered.map((p, i) => renderCard(p, i)).join('')}
      </div>
    `;

    // ── Event Listeners ──
    // Add button
    container.querySelector('#prompts-add-btn').addEventListener('click', () => openModal());

    // Search
    container.querySelector('#prompts-search').addEventListener('input', e => {
      searchText = e.target.value;
      render();
    });

    // Category filters
    container.querySelectorAll('#prompts-filters .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterCategory = btn.dataset.category;
        render();
      });
    });

    // Card actions (delegated)
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'copy')   copyPrompt(id);
        if (action === 'edit')   openModal(id);
        if (action === 'delete') deletePrompt(id);
      });
    });

    const emptyAdd = container.querySelector('#prompts-empty-add');
    if (emptyAdd) emptyAdd.addEventListener('click', () => openModal());
  }

  // ── Render a Single Card ──────────────────────────────────
  function renderCard(prompt, index) {
    const badgeClass = CATEGORY_BADGE_CLASS[prompt.category] || 'badge-custom';
    const categoryLabel = CATEGORIES.find(c => c.key === prompt.category)?.label || prompt.category;
    const promptId = escapeHtml(prompt.id);
    return `
      <div class="card" style="animation-delay: ${index * 40}ms">
        <div class="card-header">
          <span class="card-title">${escapeHtml(prompt.title)}</span>
          <div class="item-actions">
            <button class="btn-icon" data-action="copy" data-id="${promptId}" title="Copy to clipboard">📋</button>
            <button class="btn-icon" data-action="edit" data-id="${promptId}" title="Edit">✏️</button>
            <button class="btn-icon btn-icon-danger" data-action="delete" data-id="${promptId}" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="card-body">
          ${highlightVars(truncate(prompt.content, 150))}
        </div>
        <div class="card-footer">
          <div class="card-meta">
            <span class="badge ${badgeClass}">${escapeHtml(categoryLabel)}</span>
          </div>
          <span class="timestamp">${formatDate(prompt.createdAt)}</span>
        </div>
      </div>
    `;
  }

  // ── Empty State ───────────────────────────────────────────
  function renderEmptyState() {
    return `
      <div class="empty-state">
        <div class="empty-icon">💡</div>
        <div class="empty-title">No prompts yet</div>
        <div class="empty-description">
          Create reusable AI prompt templates with {{variables}} for quick access.
        </div>
        <button class="btn btn-primary btn-sm" id="prompts-empty-add">+ Create Your First Prompt</button>
      </div>
    `;
  }

  // ── Modal: Add / Edit ─────────────────────────────────────
  function openModal(promptId = null) {
    editingId = promptId;
    const existing = promptId ? prompts.find(p => p.id === promptId) : null;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'prompt-modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">${existing ? 'Edit Prompt' : 'New Prompt'}</span>
          <button class="modal-close" id="prompt-modal-close">&times;</button>
        </div>

        <div class="form-group">
          <label for="prompt-title">Title</label>
          <input class="input-field" type="text" id="prompt-title"
                 placeholder="e.g. Generate Unit Tests"
                 value="${existing ? escapeHtml(existing.title) : ''}" />
        </div>

        <div class="form-group">
          <label for="prompt-category">Category</label>
          <select class="select-field" id="prompt-category">
            ${CATEGORIES.filter(c => c.key !== 'all').map(c => `
              <option value="${c.key}" ${existing && existing.category === c.key ? 'selected' : ''}>
                ${c.label}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="prompt-content">Prompt Content</label>
          <textarea class="textarea-field" id="prompt-content" rows="6"
                    placeholder="Use {{variable}} for template placeholders…"
          >${existing ? escapeHtml(existing.content) : ''}</textarea>
          <div class="text-muted text-small mt-4">
            Tip: Use <span class="template-var">{{variable}}</span> for dynamic placeholders.
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" id="prompt-modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="prompt-modal-save">${existing ? 'Update' : 'Create'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Close handlers
    const close = () => overlay.remove();
    overlay.querySelector('#prompt-modal-close').addEventListener('click', close);
    overlay.querySelector('#prompt-modal-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    // Save handler
    overlay.querySelector('#prompt-modal-save').addEventListener('click', () => {
      const title = overlay.querySelector('#prompt-title').value.trim();
      const category = overlay.querySelector('#prompt-category').value;
      const content = overlay.querySelector('#prompt-content').value.trim();

      if (!title) {
        showToast('Please enter a title', 'warning');
        return;
      }
      if (!content) {
        showToast('Please enter prompt content', 'warning');
        return;
      }

      if (existing) {
        // Update existing
        existing.title = title;
        existing.category = category;
        existing.content = content;
        showToast('Prompt updated', 'success');
      } else {
        // Create new
        prompts.unshift({
          id: generateId(),
          title,
          category,
          content,
          createdAt: new Date().toISOString(),
        });
        showToast('Prompt created', 'success');
      }

      savePrompts();
      render();
      close();
    });

    // Focus first input
    setTimeout(() => overlay.querySelector('#prompt-title').focus(), 100);
  }

  // ── Copy Prompt ───────────────────────────────────────────
  function copyPrompt(id) {
    const prompt = prompts.find(p => p.id === id);
    if (!prompt) return;
    vscode.postMessage({ command: 'copyToClipboard', text: prompt.content });
    showToast('Copied to clipboard!', 'success');
  }

  // ── Delete Prompt ─────────────────────────────────────────
  function deletePrompt(id) {
    const prompt = prompts.find(p => p.id === id);
    if (!prompt) return;
    // Simple confirmation via re-click pattern
    prompts = prompts.filter(p => p.id !== id);
    savePrompts();
    render();
    showToast('Prompt deleted', 'info');
  }

  // ── Persist ───────────────────────────────────────────────
  function savePrompts() {
    vscode.postMessage({ command: 'saveData', key: 'prompts', data: prompts });
  }

  // ── Public API ────────────────────────────────────────────
  return {
    init() {
      render();
    },

    render,

    handleData(data) {
      if (Array.isArray(data)) {
        prompts = data;
      }
      render();
    },
  };
})();

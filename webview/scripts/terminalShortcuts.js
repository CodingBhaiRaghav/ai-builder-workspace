/* ============================================================
   AI Builder Workspace — Terminal Shortcuts Module
   
   Quick-access terminal commands with run buttons, presets,
   run history tracking, and CRUD via modal forms.
   ============================================================ */

const TerminalShortcuts = (() => {
  // ── State ─────────────────────────────────────────────────
  let shortcuts = [];
  let runHistory = []; // In-memory only, not persisted - last 10 entries

  // ── Container ─────────────────────────────────────────────
  function getContainer() {
    return document.getElementById('tab-terminal');
  }

  // ── Render ────────────────────────────────────────────────
  function render() {
    const container = getContainer();
    if (!container) return;

    container.innerHTML = `
      <!-- Header -->
      <div class="section-header">
        <span class="section-title">Quick Commands</span>
        <button class="btn btn-primary btn-sm" id="shortcuts-add-btn" title="Add Command">+ Add</button>
      </div>

      <!-- Shortcut Cards -->
      <div id="shortcuts-list">
        ${shortcuts.length === 0 ? renderEmptyState() : shortcuts.map((s, i) => renderCard(s, i)).join('')}
      </div>

      <!-- Run History -->
      ${renderHistory()}
    `;

    // ── Event Listeners ──
    container.querySelector('#shortcuts-add-btn').addEventListener('click', () => openModal());

    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'run')    runShortcut(id);
        if (action === 'edit')   openModal(id);
        if (action === 'delete') deleteShortcut(id);
      });
    });

    // Empty state add button
    const emptyAdd = container.querySelector('#shortcuts-empty-add');
    if (emptyAdd) emptyAdd.addEventListener('click', () => openModal());
  }

  // ── Render Single Card ────────────────────────────────────
  function renderCard(shortcut, index) {
    const shortcutId = escapeHtml(shortcut.id);
    return `
      <div class="card" style="animation-delay: ${index * 40}ms">
        <div class="card-header">
          <span class="card-title">${escapeHtml(shortcut.label)}</span>
          <div class="item-actions">
            <button class="btn-run btn-sm" data-action="run" data-id="${shortcutId}" title="Run in terminal">
              ▶ Run
            </button>
            <button class="btn-icon" data-action="edit" data-id="${shortcutId}" title="Edit">✏️</button>
            <button class="btn-icon btn-icon-danger" data-action="delete" data-id="${shortcutId}" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="code-block">${escapeHtml(shortcut.command)}</div>
        ${shortcut.lastRun
          ? `<div class="mt-4"><span class="timestamp">Last run: ${formatDate(shortcut.lastRun)}</span></div>`
          : ''
        }
      </div>
    `;
  }

  // ── Empty State ───────────────────────────────────────────
  function renderEmptyState() {
    return `
      <div class="empty-state">
        <div class="empty-icon">⚡</div>
        <div class="empty-title">No shortcuts yet</div>
        <div class="empty-description">
          Save your frequently used terminal commands for one-click execution.
        </div>
        <button class="btn btn-primary btn-sm" id="shortcuts-empty-add">+ Add Your First Command</button>
      </div>
    `;
  }

  // ── Run History Section ───────────────────────────────────
  function renderHistory() {
    if (runHistory.length === 0) return '';

    const recent = runHistory.slice(0, 5);

    return `
      <div class="history-section">
        <div class="section-header">
          <span class="section-title" style="font-size:12px;">Run History</span>
          <span class="text-muted text-small">${runHistory.length} total</span>
        </div>
        ${recent.map(h => `
          <div class="history-item">
            <span style="color: var(--vscode-terminal-ansiGreen, #4ec94e); font-size:11px;">▶</span>
            <span class="history-cmd">${escapeHtml(h.command)}</span>
            <span class="history-time">${formatDate(h.time)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── Modal: Add / Edit ─────────────────────────────────────
  function openModal(shortcutId = null) {
    const existing = shortcutId ? shortcuts.find(s => s.id === shortcutId) : null;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">${existing ? 'Edit Command' : 'New Command'}</span>
          <button class="modal-close" id="shortcut-modal-close">&times;</button>
        </div>

        <div class="form-group">
          <label for="shortcut-label">Label</label>
          <input class="input-field" type="text" id="shortcut-label"
                 placeholder="e.g. Run Tests"
                 value="${existing ? escapeHtml(existing.label) : ''}" />
        </div>

        <div class="form-group">
          <label for="shortcut-command">Command</label>
          <input class="input-field mono" type="text" id="shortcut-command"
                 placeholder="e.g. npm test -- --watch"
                 value="${existing ? escapeHtml(existing.command) : ''}" />
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" id="shortcut-modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="shortcut-modal-save">${existing ? 'Update' : 'Create'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#shortcut-modal-close').addEventListener('click', close);
    overlay.querySelector('#shortcut-modal-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    overlay.querySelector('#shortcut-modal-save').addEventListener('click', () => {
      const label = overlay.querySelector('#shortcut-label').value.trim();
      const command = overlay.querySelector('#shortcut-command').value.trim();

      if (!label) {
        showToast('Please enter a label', 'warning');
        return;
      }
      if (!command) {
        showToast('Please enter a command', 'warning');
        return;
      }

      if (existing) {
        existing.label = label;
        existing.command = command;
        showToast('Command updated', 'success');
      } else {
        shortcuts.push({
          id: generateId(),
          label,
          command,
          lastRun: null,
        });
        showToast('Command created', 'success');
      }

      saveShortcuts();
      render();
      close();
    });

    setTimeout(() => overlay.querySelector('#shortcut-label').focus(), 100);
  }

  // ── Run Shortcut ──────────────────────────────────────────
  function runShortcut(id) {
    const shortcut = shortcuts.find(s => s.id === id);
    if (!shortcut) return;

    // Send to extension to run in terminal
    vscode.postMessage({
      command: 'runTerminalCommand',
      commandText: shortcut.command,
      label: shortcut.label,
    });

    // Update lastRun
    shortcut.lastRun = new Date().toISOString();

    // Add to history
    runHistory.unshift({
      command: shortcut.command,
      time: new Date().toISOString(),
    });
    // Cap history at 10
    if (runHistory.length > 10) runHistory = runHistory.slice(0, 10);

    saveShortcuts();
    render();
    showToast(`Running: ${shortcut.label}`, 'success');
  }

  // ── Delete Shortcut ───────────────────────────────────────
  function deleteShortcut(id) {
    shortcuts = shortcuts.filter(s => s.id !== id);
    saveShortcuts();
    render();
    showToast('Command deleted', 'info');
  }

  // ── Persist ───────────────────────────────────────────────
  function saveShortcuts() {
    vscode.postMessage({ command: 'saveData', key: 'shortcuts', data: shortcuts });
  }

  // ── Public API ────────────────────────────────────────────
  return {
    init() {
      render();
    },

    render,

    handleData(data) {
      if (Array.isArray(data)) {
        shortcuts = data;
      }
      render();
    },
  };
})();

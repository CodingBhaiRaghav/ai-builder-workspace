/* ============================================================
   AI Builder Workspace — Main App Orchestrator (app.js)
   
   This script:
   1. Acquires the VS Code API (once)
   2. Renders the shell (tab bar + tab panels)
   3. Initializes all 5 feature modules
   4. Handles tab switching with state persistence
   5. Dispatches incoming messages to the correct module
   6. Provides shared utility helpers
   ============================================================ */

// ── VS Code API (acquired once, used globally) ──────────────
const vscode = acquireVsCodeApi();

// ── Shared Helpers ──────────────────────────────────────────

/**
 * Generate a random ID string (16 hex chars).
 * @returns {string}
 */
function generateId() {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Format an ISO date string into a human-readable relative time.
 * E.g. "just now", "2 min ago", "3 hours ago", "yesterday", "May 20"
 * @param {string} isoString
 * @returns {string}
 */
function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 30) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;

  // Fallback: short date
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Show a toast notification inside the webview.
 * @param {string} message  — The message to display
 * @param {'success'|'error'|'info'|'warning'} [type='info'] — Toast type
 * @param {number} [duration=3000] — Auto-dismiss time in ms
 */
function showToast(message, type = 'info', duration = 3000) {
  // Ensure the toast container exists
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.add('toast-dismissing');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Tab Definitions ─────────────────────────────────────────
const TABS = [
  { id: 'orchestrator', icon: '🤖', label: 'Plan' },
  { id: 'prompts',  icon: '💡', label: 'Prompts' },
  { id: 'tasks',    icon: '✅', label: 'Tasks' },
  { id: 'notes',    icon: '📝', label: 'Notes' },
  { id: 'terminal', icon: '⚡', label: 'Terminal' },
  { id: 'memory',   icon: '🧠', label: 'Memory' },
  { id: 'git',      icon: '🌿', label: 'Git' },
];

// ── Render Shell ────────────────────────────────────────────

/**
 * Build and inject the app shell HTML: tab bar + tab content panels.
 */
function renderShell() {
  const app = document.getElementById('app');
  if (!app) return;

  // Build tab bar
  const tabBarHtml = `
    <nav class="tab-bar" role="tablist" aria-label="Main Navigation">
      ${TABS.map(t => `
        <button class="tab-item" role="tab"
                aria-selected="false"
                aria-controls="tab-${t.id}"
                data-tab="${t.id}"
                title="${t.label}">
          <span class="tab-icon">${t.icon}</span>
          <span class="tab-label">${t.label}</span>
        </button>
      `).join('')}
    </nav>
  `;

  // Build content panels
  const panelsHtml = TABS.map(t => `
    <section id="tab-${t.id}"
             class="tab-content"
             role="tabpanel"
             aria-labelledby="tab-btn-${t.id}">
    </section>
  `).join('');

  app.innerHTML = tabBarHtml + panelsHtml;
}

// ── Tab Switching ───────────────────────────────────────────

/**
 * Switch to a specific tab by ID.
 * @param {string} tabId
 */
function switchTab(tabId) {
  // Update tab buttons
  document.querySelectorAll('.tab-item').forEach(btn => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Update tab panels
  document.querySelectorAll('.tab-content').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabId}`);
  });

  // Persist active tab in webview state
  const currentState = vscode.getState() || {};
  vscode.setState({ ...currentState, activeTab: tabId });
}

/**
 * Set up click listeners on tab buttons.
 */
function initTabListeners() {
  document.querySelectorAll('.tab-item').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });
}

// ── Message Dispatcher ──────────────────────────────────────

/**
 * Listen for messages from the extension host and dispatch
 * to the correct feature module.
 */
function initMessageListener() {
  window.addEventListener('message', event => {
    const msg = event.data;
    if (!msg || !msg.command) return;

    switch (msg.command) {
      // ── Data loaded for a specific key ──
      case 'dataLoaded':
        dispatchDataLoaded(msg.key, msg.data);
        break;

      // ── All data loaded at once ──
      case 'allDataLoaded':
        if (msg.data) {
          if (typeof Orchestrator !== 'undefined')       Orchestrator.handleData(msg.data.sessionState || null, msg.data.projectMemory || [], msg.data.shortcuts || []);
          if (typeof PromptLibrary !== 'undefined')      PromptLibrary.handleData(msg.data.prompts || []);
          if (typeof TaskManager !== 'undefined')        TaskManager.handleData(msg.data.tasks || []);
          if (typeof Notes !== 'undefined')              Notes.handleData(msg.data.notes || []);
          if (typeof TerminalShortcuts !== 'undefined')  TerminalShortcuts.handleData(msg.data.shortcuts || []);
          if (typeof ProjectMemory !== 'undefined')      ProjectMemory.handleData(msg.data.projectMemory || []);
          if (typeof GitManager !== 'undefined')         GitManager.init();
        }
        break;

      // ── Workspace info ──
      case 'workspaceInfo':
        if (typeof ProjectMemory !== 'undefined') {
          ProjectMemory.handleWorkspaceInfo(msg.data);
        }
        break;

      // ── Save confirmation ──
      case 'dataSaved':
        if (msg.success) {
          // Optionally show a subtle confirmation
        } else {
          showToast('Failed to save data', 'error');
        }
        break;

      default:
        // Unknown command — ignore
        break;
    }
  });
}

/**
 * Route a dataLoaded message to the correct module.
 */
function dispatchDataLoaded(key, data) {
  switch (key) {
    case 'prompts':
      if (typeof PromptLibrary !== 'undefined') PromptLibrary.handleData(data || []);
      break;
    case 'tasks':
      if (typeof TaskManager !== 'undefined') TaskManager.handleData(data || []);
      break;
    case 'notes':
      if (typeof Notes !== 'undefined') Notes.handleData(data || []);
      break;
    case 'shortcuts':
      if (typeof TerminalShortcuts !== 'undefined') TerminalShortcuts.handleData(data || []);
      break;
    case 'projectMemory':
      if (typeof ProjectMemory !== 'undefined') ProjectMemory.handleData(data || []);
      if (typeof Orchestrator !== 'undefined') Orchestrator.handleMemoryUpdate(data || []);
      break;
    case 'sessionState':
      if (typeof Orchestrator !== 'undefined') Orchestrator.handleData(data || null);
      break;
  }
}

// ── Initialization ──────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // 1. Render the app shell
  renderShell();

  // 2. Set up tab switching
  initTabListeners();

  // 3. Initialize feature modules (they render into their containers)
  if (typeof Orchestrator !== 'undefined')       Orchestrator.init();
  if (typeof PromptLibrary !== 'undefined')      PromptLibrary.init();
  if (typeof TaskManager !== 'undefined')        TaskManager.init();
  if (typeof Notes !== 'undefined')              Notes.init();
  if (typeof TerminalShortcuts !== 'undefined')  TerminalShortcuts.init();
  if (typeof ProjectMemory !== 'undefined')      ProjectMemory.init();
  if (typeof GitManager !== 'undefined')         GitManager.init();

  // 4. Set up message listener
  initMessageListener();

  // 5. Restore last active tab from state, default to 'prompts'
  const savedState = vscode.getState() || {};
  const activeTab = savedState.activeTab || 'prompts';
  switchTab(activeTab);

  // 6. Tell the extension we're ready and request all data
  vscode.postMessage({ command: 'ready' });
});

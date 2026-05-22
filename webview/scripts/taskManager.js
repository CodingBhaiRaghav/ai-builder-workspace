/* ============================================================
   AI Builder Workspace — Task Manager Module
   
   Kanban-style task tracker with progress visualization,
   priority badges, status cycling, reordering, filtering,
   and full CRUD via modal forms.
   ============================================================ */

const TaskManager = (() => {
  // ── State ─────────────────────────────────────────────────
  let tasks = [];
  let filterStatus = 'all';
  let filterPriority = 'all';

  // ── Status / Priority Definitions ─────────────────────────
  const STATUSES = [
    { key: 'all',         label: 'All' },
    { key: 'todo',        label: 'Todo' },
    { key: 'in-progress', label: 'In Progress' },
    { key: 'done',        label: 'Done' },
  ];

  const PRIORITIES = [
    { key: 'all',    label: 'All' },
    { key: 'high',   label: 'High' },
    { key: 'medium', label: 'Medium' },
    { key: 'low',    label: 'Low' },
  ];

  const STATUS_CYCLE = ['todo', 'in-progress', 'done'];

  const STATUS_BADGE = {
    'todo':        'badge-todo',
    'in-progress': 'badge-in-progress',
    'done':        'badge-done',
  };

  const STATUS_LABEL = {
    'todo':        'Todo',
    'in-progress': 'In Progress',
    'done':        'Done',
  };

  const PRIORITY_BADGE = {
    high:   'badge-high',
    medium: 'badge-medium',
    low:    'badge-low',
  };

  const STATUS_ICON = {
    'todo':        '○',
    'in-progress': '◐',
    'done':        '●',
  };

  // ── Container ─────────────────────────────────────────────
  function getContainer() {
    return document.getElementById('tab-tasks');
  }

  // ── Filtering ─────────────────────────────────────────────
  function getFilteredTasks() {
    return tasks
      .filter(t => {
        if (filterStatus !== 'all' && t.status !== filterStatus) return false;
        if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
        return true;
      })
      .sort((a, b) => a.order - b.order);
  }

  // ── Stats ─────────────────────────────────────────────────
  function getStats() {
    const todo = tasks.filter(t => t.status === 'todo').length;
    const inProg = tasks.filter(t => t.status === 'in-progress').length;
    const done = tasks.filter(t => t.status === 'done').length;
    const total = tasks.length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { todo, inProg, done, total, percent };
  }

  // ── Render ────────────────────────────────────────────────
  function render() {
    const container = getContainer();
    if (!container) return;

    const stats = getStats();
    const filtered = getFilteredTasks();

    container.innerHTML = `
      <!-- Header -->
      <div class="section-header">
        <span class="section-title">Task Manager</span>
        <button class="btn btn-primary btn-sm" id="tasks-add-btn" title="Add Task">+ Add</button>
      </div>

      <!-- Progress Bar -->
      <div class="progress-bar-container">
        <div class="progress-bar-label">
          <span class="progress-text">Completion</span>
          <span class="progress-percent">${stats.percent}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width: ${stats.percent}%"></div>
        </div>
      </div>

      <!-- Stats Row -->
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-number">${stats.todo}</span>
          <span class="stat-label">Todo</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">${stats.inProg}</span>
          <span class="stat-label">Active</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">${stats.done}</span>
          <span class="stat-label">Done</span>
        </div>
      </div>

      <!-- Filters: Status -->
      <div class="text-muted text-small mb-4" style="font-weight:600;">Status</div>
      <div class="filter-row" id="tasks-status-filter">
        ${STATUSES.map(s => `
          <button class="filter-btn ${filterStatus === s.key ? 'active' : ''}"
                  data-status="${s.key}">
            ${s.label}
          </button>
        `).join('')}
      </div>

      <!-- Filters: Priority -->
      <div class="text-muted text-small mb-4" style="font-weight:600;">Priority</div>
      <div class="filter-row mb-8" id="tasks-priority-filter">
        ${PRIORITIES.map(p => `
          <button class="filter-btn ${filterPriority === p.key ? 'active' : ''}"
                  data-priority="${p.key}">
            ${p.label}
          </button>
        `).join('')}
      </div>

      <!-- Task Cards -->
      <div id="tasks-list">
        ${filtered.length === 0 ? renderEmptyState() : filtered.map((t, i) => renderCard(t, i, filtered)).join('')}
      </div>
    `;

    // ── Event Listeners ──
    container.querySelector('#tasks-add-btn').addEventListener('click', () => openModal());

    // Status filter
    container.querySelectorAll('#tasks-status-filter .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterStatus = btn.dataset.status;
        render();
      });
    });

    // Priority filter
    container.querySelectorAll('#tasks-priority-filter .filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterPriority = btn.dataset.priority;
        render();
      });
    });

    // Card actions (delegated)
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'cycle')    cycleStatus(id);
        if (action === 'edit')     openModal(id);
        if (action === 'delete')   deleteTask(id);
        if (action === 'moveup')   moveTask(id, -1);
        if (action === 'movedown') moveTask(id, 1);
      });
    });

    // Empty state add button
    const emptyAdd = container.querySelector('#tasks-empty-add');
    if (emptyAdd) emptyAdd.addEventListener('click', () => openModal());
  }

  // ── Render Single Card ────────────────────────────────────
  function renderCard(task, index, list) {
    const statusBadge = STATUS_BADGE[task.status] || 'badge-todo';
    const priorityBadge = PRIORITY_BADGE[task.priority] || 'badge-low';
    const statusLabel = STATUS_LABEL[task.status] || task.status;
    const statusIcon = STATUS_ICON[task.status] || '○';
    const taskId = escapeHtml(task.id);
    const escapedStatusLabel = escapeHtml(statusLabel);
    const isDone = task.status === 'done';
    const isFirst = index === 0;
    const isLast = index === list.length - 1;

    return `
      <div class="card ${isDone ? 'card-done' : ''}" style="animation-delay: ${index * 40}ms; ${isDone ? 'opacity: 0.65;' : ''}">
        <div class="card-header">
          <div class="flex items-center gap-8" style="flex:1; min-width:0;">
            <button class="btn-icon btn-icon-success" data-action="cycle" data-id="${taskId}"
                    title="Cycle status: ${escapedStatusLabel}" style="font-size:16px;">
              ${statusIcon}
            </button>
            <span class="card-title" style="${isDone ? 'text-decoration: line-through;' : ''}">
              ${escapeHtml(task.title)}
            </span>
          </div>
          <div class="item-actions">
            <button class="btn-icon" data-action="moveup" data-id="${taskId}" title="Move up" ${isFirst ? 'disabled style="opacity:0.3"' : ''}>↑</button>
            <button class="btn-icon" data-action="movedown" data-id="${taskId}" title="Move down" ${isLast ? 'disabled style="opacity:0.3"' : ''}>↓</button>
            <button class="btn-icon" data-action="edit" data-id="${taskId}" title="Edit">✏️</button>
            <button class="btn-icon btn-icon-danger" data-action="delete" data-id="${taskId}" title="Delete">🗑️</button>
          </div>
        </div>
        ${task.description ? `<div class="card-body" style="margin-left: 36px;">${escapeHtml(truncate(task.description, 120))}</div>` : ''}
        <div class="card-footer" style="margin-left: 36px;">
          <div class="card-meta">
            <span class="badge ${statusBadge}">${escapedStatusLabel}</span>
            <span class="badge ${priorityBadge}">${escapeHtml(capitalize(task.priority))}</span>
          </div>
          <span class="timestamp">${formatDate(task.createdAt)}</span>
        </div>
      </div>
    `;
  }

  // ── Empty State ───────────────────────────────────────────
  function renderEmptyState() {
    return `
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <div class="empty-title">No tasks here</div>
        <div class="empty-description">
          Stay organized by tracking your development tasks and their progress.
        </div>
        <button class="btn btn-primary btn-sm" id="tasks-empty-add">+ Create Your First Task</button>
      </div>
    `;
  }

  // ── Modal: Add / Edit ─────────────────────────────────────
  function openModal(taskId = null) {
    const existing = taskId ? tasks.find(t => t.id === taskId) : null;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">${existing ? 'Edit Task' : 'New Task'}</span>
          <button class="modal-close" id="task-modal-close">&times;</button>
        </div>

        <div class="form-group">
          <label for="task-title">Title</label>
          <input class="input-field" type="text" id="task-title"
                 placeholder="e.g. Implement auth flow"
                 value="${existing ? escapeHtml(existing.title) : ''}" />
        </div>

        <div class="form-group">
          <label for="task-description">Description (optional)</label>
          <textarea class="textarea-field" id="task-description" rows="3"
                    placeholder="Add more details…"
          >${existing ? escapeHtml(existing.description) : ''}</textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="task-priority">Priority</label>
            <select class="select-field" id="task-priority">
              <option value="high"   ${existing && existing.priority === 'high' ? 'selected' : ''}>High</option>
              <option value="medium" ${(!existing || existing.priority === 'medium') ? 'selected' : ''}>Medium</option>
              <option value="low"    ${existing && existing.priority === 'low' ? 'selected' : ''}>Low</option>
            </select>
          </div>
          ${existing ? `
          <div class="form-group">
            <label for="task-status">Status</label>
            <select class="select-field" id="task-status">
              <option value="todo"        ${existing.status === 'todo' ? 'selected' : ''}>Todo</option>
              <option value="in-progress" ${existing.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
              <option value="done"        ${existing.status === 'done' ? 'selected' : ''}>Done</option>
            </select>
          </div>
          ` : ''}
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" id="task-modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="task-modal-save">${existing ? 'Update' : 'Create'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#task-modal-close').addEventListener('click', close);
    overlay.querySelector('#task-modal-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    overlay.querySelector('#task-modal-save').addEventListener('click', () => {
      const title = overlay.querySelector('#task-title').value.trim();
      const description = overlay.querySelector('#task-description').value.trim();
      const priority = overlay.querySelector('#task-priority').value;

      if (!title) {
        showToast('Please enter a title', 'warning');
        return;
      }

      if (existing) {
        existing.title = title;
        existing.description = description;
        existing.priority = priority;
        const statusEl = overlay.querySelector('#task-status');
        if (statusEl) existing.status = statusEl.value;
        showToast('Task updated', 'success');
      } else {
        const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order)) : -1;
        tasks.push({
          id: generateId(),
          title,
          description,
          priority,
          status: 'todo',
          order: maxOrder + 1,
          createdAt: new Date().toISOString(),
        });
        showToast('Task created', 'success');
      }

      saveTasks();
      render();
      close();
    });

    setTimeout(() => overlay.querySelector('#task-title').focus(), 100);
  }

  // ── Cycle Status ──────────────────────────────────────────
  function cycleStatus(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const idx = STATUS_CYCLE.indexOf(task.status);
    task.status = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    saveTasks();
    render();
  }

  // ── Move Task ─────────────────────────────────────────────
  function moveTask(id, direction) {
    const sorted = [...tasks].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(t => t.id === id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    // Swap orders
    const tmpOrder = sorted[idx].order;
    sorted[idx].order = sorted[swapIdx].order;
    sorted[swapIdx].order = tmpOrder;

    saveTasks();
    render();
  }

  // ── Delete Task ───────────────────────────────────────────
  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    render();
    showToast('Task deleted', 'info');
  }

  // ── Persist ───────────────────────────────────────────────
  function saveTasks() {
    vscode.postMessage({ command: 'saveData', key: 'tasks', data: tasks });
  }

  // ── Helpers ───────────────────────────────────────────────
  function truncate(str, len = 120) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
  }

  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  // ── Public API ────────────────────────────────────────────
  return {
    init() {
      render();
    },

    render,

    handleData(data) {
      if (Array.isArray(data)) {
        tasks = data;
      }
      render();
    },
  };
})();

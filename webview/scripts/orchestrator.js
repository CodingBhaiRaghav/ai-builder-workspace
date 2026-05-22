/* ============================================================
   AI Builder Workspace — Orchestrator Module
   
   A heuristic offline engine that acts as the orchestrator.
   Maps purpose keywords to saved project memory and shortcuts
   to string together an execution plan. Tracks session state.
   ============================================================ */

const Orchestrator = (() => {
  // ── State ─────────────────────────────────────────────────
  let session = null; // { purpose, steps: [], currentStepIndex, updatedAt }
  let memory = [];
  let shortcuts = [];

  // ── Container ─────────────────────────────────────────────
  function getContainer() {
    return document.getElementById('tab-orchestrator');
  }

  // ── Plan Generation Heuristic Engine ──────────────────────
  function generatePlan(purpose) {
    const steps = [];
    const lowerPurpose = purpose.toLowerCase();

    // 1. Analyze Git needs
    if (lowerPurpose.includes('commit') || lowerPurpose.includes('save') || lowerPurpose.includes('push')) {
      steps.push({
        id: generateId(),
        description: 'Check Git Status',
        command: 'git status',
        status: 'pending'
      });
      steps.push({
        id: generateId(),
        description: 'Stage and Commit Changes',
        command: 'git add . && git commit -m "Auto-commit via AI Builder"',
        status: 'pending'
      });
    }

    // 2. Analyze Build/Dev needs
    if (lowerPurpose.includes('build') || lowerPurpose.includes('compile')) {
      const buildShortcut = shortcuts.find(s => {
        const label = s.label.toLowerCase();
        return label.includes('build') || label.includes('compile');
      });
      steps.push({
        id: generateId(),
        description: 'Compile/Build Project',
        command: buildShortcut ? buildShortcut.command : 'npm run compile',
        status: 'pending'
      });
    }
    
    if (lowerPurpose.includes('dev') || lowerPurpose.includes('start') || lowerPurpose.includes('run')) {
      const devShortcut = shortcuts.find(s => {
        const label = s.label.toLowerCase();
        return label.includes('dev') || label.includes('start') || label.includes('watch');
      });
      steps.push({
        id: generateId(),
        description: 'Start Watch Mode',
        command: devShortcut ? devShortcut.command : 'npm run watch',
        status: 'pending'
      });
    }

    if (lowerPurpose.includes('deploy')) {
      steps.push({
        id: generateId(),
        description: 'Prepare Deployment',
        command: 'npm run compile',
        status: 'pending'
      });
      steps.push({
        id: generateId(),
        description: 'Deploy to Environment',
        command: 'echo "Manual deployment required or configure shortcut"',
        status: 'pending'
      });
    }

    // 3. Scan Memory for Context Integration
    const relevantMemory = memory.filter(m => lowerPurpose.includes(m.key.toLowerCase()) || m.category === 'conventions');
    if (relevantMemory.length > 0) {
      steps.push({
        id: generateId(),
        description: 'Review Context & Conventions',
        output: relevantMemory.map(m => `**${m.key}**: ${m.value}`).join('\n'),
        status: 'pending'
      });
    }

    // Fallback if empty
    if (steps.length === 0) {
      steps.push({
        id: generateId(),
        description: 'Analyze Workspace',
        command: 'dir || ls',
        status: 'pending'
      });
      steps.push({
        id: generateId(),
        description: `Execute Custom Task: ${purpose}`,
        command: '',
        status: 'pending'
      });
    }

    return steps;
  }

  // ── Render ────────────────────────────────────────────────
  function render() {
    const container = getContainer();
    if (!container) return;

    if (!session || !session.purpose) {
      // Input State
      container.innerHTML = `
        <div class="empty-state" style="margin-top: 40px;">
          <div class="empty-icon">🤖</div>
          <div class="empty-title">Goal-Driven Orchestrator</div>
          <div class="empty-description">
            Tell me your purpose. I will analyze project memory and shortcuts to generate an automated terminal workflow.
          </div>
          <div class="form-group" style="text-align: left; width: 100%; max-width: 400px; margin: 20px auto;">
            <input class="input-field" type="text" id="orchestrator-purpose" placeholder="e.g. Build and deploy the app..." />
          </div>
          <button class="btn btn-primary" id="orchestrator-start-btn">Generate Plan</button>
        </div>
      `;

      container.querySelector('#orchestrator-start-btn').addEventListener('click', () => {
        const input = container.querySelector('#orchestrator-purpose').value.trim();
        if (!input) {
          showToast('Please enter a purpose', 'warning');
          return;
        }
        startSession(input);
      });
      return;
    }

    // Execution State
    const progress = session.steps.length === 0 ? 0 : Math.round((session.steps.filter(s => s.status === 'done').length / session.steps.length) * 100);

    container.innerHTML = `
      <div class="section-header">
        <span class="section-title">Current Goal: ${escapeHtml(session.purpose)}</span>
        <div class="item-actions">
          <button class="btn btn-danger btn-sm" id="orchestrator-stop-btn">Stop / Clear</button>
        </div>
      </div>

      <div class="progress-bar-container">
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width: ${progress}%"></div>
        </div>
        <div style="font-size: 11px; opacity: 0.7; margin-top: 4px; text-align: right;">${progress}% Complete</div>
      </div>

      <div class="timeline">
        ${session.steps.map((step, index) => renderStep(step, index)).join('')}
      </div>
    `;

    // Bind execution buttons
    container.querySelectorAll('.run-step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        runStep(idx);
      });
    });
    
    container.querySelectorAll('.mark-done-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        markStepDone(idx);
      });
    });

    container.querySelector('#orchestrator-stop-btn').addEventListener('click', () => {
      session = null;
      saveSession();
      render();
    });
  }

  function renderStep(step, index) {
    const isActive = session.currentStepIndex === index;
    const isDone = step.status === 'done';
    
    let statusIcon = '⏳';
    let cardClass = 'card';
    if (isDone) {
      statusIcon = '✅';
      cardClass += ' done';
    } else if (isActive) {
      statusIcon = '▶️';
      cardClass += ' active-step';
    }

    let actionsHtml = '';
    if (isActive) {
      if (step.command) {
        actionsHtml = `<button class="btn btn-primary btn-sm run-step-btn" data-index="${index}">Execute Command</button>
                       <button class="btn btn-secondary btn-sm mark-done-btn" data-index="${index}">Skip</button>`;
      } else {
        actionsHtml = `<button class="btn btn-primary btn-sm mark-done-btn" data-index="${index}">Mark Done</button>`;
      }
    } else if (!isDone) {
      actionsHtml = `<span style="opacity: 0.5; font-size: 12px;">Pending</span>`;
    }

    return `
      <div class="${cardClass}" style="border-left: 4px solid ${isActive ? 'var(--vscode-button-background)' : 'transparent'};">
        <div class="card-header">
          <span class="card-title">${statusIcon} Step ${index + 1}: ${escapeHtml(step.description)}</span>
        </div>
        ${step.command ? `<div class="card-body" style="font-family: monospace; background: var(--vscode-editor-background); padding: 8px; border-radius: 4px; border: 1px solid var(--vscode-widget-border);">${escapeHtml(step.command)}</div>` : ''}
        ${step.output ? `<div class="card-body" style="white-space: pre-wrap; font-size: 12px;">${escapeHtml(step.output)}</div>` : ''}
        <div class="card-footer" style="justify-content: flex-end; padding-top: 10px;">
          ${actionsHtml}
        </div>
      </div>
    `;
  }

  // ── Actions ───────────────────────────────────────────────
  function startSession(purpose) {
    session = {
      purpose,
      steps: generatePlan(purpose),
      currentStepIndex: 0,
      updatedAt: new Date().toISOString()
    };
    saveSession();
    render();
  }

  function runStep(index) {
    const step = session.steps[index];
    if (!step || !step.command) return;

    vscode.postMessage({
      command: 'runTerminalCommand',
      label: step.description,
      commandText: step.command
    });

    // Mark as done assuming success (heuristically)
    markStepDone(index);
  }

  function markStepDone(index) {
    if (session.steps[index]) {
      session.steps[index].status = 'done';
      session.currentStepIndex = index + 1;
      
      // If completed all
      if (session.currentStepIndex >= session.steps.length) {
        showToast('Workflow completed!', 'success');
      }
      
      saveSession();
      render();
    }
  }

  // ── Persist ───────────────────────────────────────────────
  function saveSession() {
    vscode.postMessage({ command: 'saveData', key: 'sessionState', data: session });
  }

  // ── Public API ────────────────────────────────────────────
  return {
    init() {
      render();
    },

    render,

    handleData(savedSession, projMemory, proShortcuts) {
      if (savedSession !== undefined) session = savedSession;
      if (projMemory !== undefined) memory = projMemory;
      if (proShortcuts !== undefined) shortcuts = proShortcuts;
      render();
    },
    
    handleMemoryUpdate(projMemory) {
      memory = projMemory;
    }
  };
})();

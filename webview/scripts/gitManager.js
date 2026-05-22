/* ============================================================
   AI Builder Workspace — Git Manager Module
   
   Integration of Git to load previous stable models and 
   manage version history directly from the AI Builder UI.
   ============================================================ */

const GitManager = (() => {
  // ── Container ─────────────────────────────────────────────
  function getContainer() {
    return document.getElementById('tab-git');
  }

  // ── Render ────────────────────────────────────────────────
  function render() {
    const container = getContainer();
    if (!container) return;

    container.innerHTML = `
      <div class="section-header">
        <span class="section-title">Git Integration</span>
      </div>
      <p style="opacity: 0.8; font-size: 12px; margin-bottom: 15px;">
        Use these tools to safeguard your work and load previous stable models (commits).
      </p>

      <!-- Safeguard Card -->
      <div class="card" style="border-left: 4px solid var(--vscode-charts-orange);">
        <div class="card-header">
          <span class="card-title">1. Safeguard Current Work</span>
        </div>
        <div class="card-body">
          Always check your status and stash uncommitted changes before loading a previous model.
        </div>
        <div class="card-footer" style="justify-content: flex-start; gap: 8px;">
          <button class="btn btn-secondary btn-sm" id="git-status-btn">Check Status</button>
          <button class="btn btn-secondary btn-sm" id="git-stash-btn">Stash Changes</button>
        </div>
      </div>

      <!-- History Card -->
      <div class="card" style="border-left: 4px solid var(--vscode-charts-blue);">
        <div class="card-header">
          <span class="card-title">2. View Stable Models</span>
        </div>
        <div class="card-body">
          Print the recent Git commit history in the terminal to find the hash of the previous stable state you want to load.
        </div>
        <div class="card-footer" style="justify-content: flex-start; gap: 8px;">
          <button class="btn btn-secondary btn-sm" id="git-log-btn">View Git History</button>
        </div>
      </div>

      <!-- Restore Card -->
      <div class="card" style="border-left: 4px solid var(--vscode-charts-green);">
        <div class="card-header">
          <span class="card-title">3. Load Stable Model</span>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label for="git-commit-hash">Commit Hash or Tag</label>
            <input class="input-field" type="text" id="git-commit-hash" placeholder="e.g. 3a5f8b2 or HEAD~1" />
          </div>
        </div>
        <div class="card-footer" style="justify-content: flex-start;">
          <button class="btn btn-primary btn-sm" id="git-checkout-btn">Load (Checkout)</button>
        </div>
      </div>
    `;

    // ── Event Listeners ──
    container.querySelector('#git-status-btn').addEventListener('click', () => {
      runGitCommand('git status', 'Checking Git Status');
    });

    container.querySelector('#git-stash-btn').addEventListener('click', () => {
      runGitCommand('git stash', 'Stashing Changes');
    });

    container.querySelector('#git-log-btn').addEventListener('click', () => {
      runGitCommand('git log --oneline -n 15', 'Viewing Git History');
    });

    container.querySelector('#git-checkout-btn').addEventListener('click', () => {
      const hash = container.querySelector('#git-commit-hash').value.trim();
      if (!hash) {
        showToast('Please enter a commit hash or branch name', 'warning');
        return;
      }
      if (!isSafeGitRef(hash)) {
        showToast('Use a plain commit, tag, or branch name without spaces or shell characters', 'warning');
        return;
      }
      runGitCommand(`git checkout ${hash}`, `Loading Model: ${hash}`);
    });
  }

  function isSafeGitRef(ref) {
    return /^[A-Za-z0-9._/@~^:-]+$/.test(ref);
  }

  function runGitCommand(commandText, label) {
    vscode.postMessage({
      command: 'runTerminalCommand',
      label,
      commandText
    });
  }

  // ── Public API ────────────────────────────────────────────
  return {
    init() {
      render();
    }
  };
})();

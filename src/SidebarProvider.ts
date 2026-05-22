/**
 * SidebarProvider.ts
 *
 * Implements `vscode.WebviewViewProvider` to power the AI Builder Workspace
 * sidebar panel. Handles all message traffic between the webview front-end
 * and the VS Code extension host.
 */

import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import {
    StorageService,
    type MemoryEntry,
    type Note,
    type Prompt,
    type SessionState,
    type Shortcut,
    type Task,
} from './services/StorageService';

type DataKey =
    | 'prompts'
    | 'tasks'
    | 'notes'
    | 'shortcuts'
    | 'projectMemory'
    | 'sessionState';

const DATA_KEYS = new Set<DataKey>([
    'prompts',
    'tasks',
    'notes',
    'shortcuts',
    'projectMemory',
    'sessionState',
]);

/**
 * Provides the sidebar webview for the AI Builder Workspace extension.
 *
 * Lifecycle:
 * 1. VS Code calls `resolveWebviewView()` when the sidebar is first shown.
 * 2. The webview loads its HTML, CSS, and JS bundles.
 * 3. The webview posts a `ready` message — we respond with all stored data.
 * 4. Subsequent messages follow the shared message protocol.
 */
export class SidebarProvider implements vscode.WebviewViewProvider, vscode.Disposable {

    /** Must match the `id` declared in package.json `views` contribution. */
    public static readonly viewType = 'aiBuilderWorkspace.sidebar';

    /** The resolved webview view instance; set once VS Code creates the panel. */
    private _view?: vscode.WebviewView;

    /**
     * A reference to the shared "AI Builder" terminal.
     * We reuse it across commands and recreate it if the user closes it.
     */
    private _terminal: vscode.Terminal | undefined;

    private readonly _terminalCloseDisposable: vscode.Disposable;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _storage: StorageService,
    ) {
        this._terminalCloseDisposable = vscode.window.onDidCloseTerminal((closed) => {
            if (closed === this._terminal) {
                this._terminal = undefined;
            }
        });
    }

    public dispose(): void {
        this._terminalCloseDisposable.dispose();
    }

    // ─── WebviewViewProvider ────────────────────────────────────────────

    /**
     * Called by VS Code when the sidebar view is first displayed.
     * Sets up the webview options, injects HTML, and wires the message handler.
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ): void {
        this._view = webviewView;

        // Configure the webview
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri,
                vscode.Uri.joinPath(this._extensionUri, 'webview'),
            ],
        };

        // Inject the HTML content
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Listen for messages from the webview
        webviewView.webview.onDidReceiveMessage(
            (message: any) => this._handleMessage(message),
            undefined,
            // No disposable array needed — the view itself manages teardown.
        );

    }

    // ─── Public API ─────────────────────────────────────────────────────

    /**
     * Post a message to the webview.
     * Safe to call even when the view is not visible — calls are silently dropped.
     */
    public postMessage(message: any): void {
        this._view?.webview.postMessage(message);
    }

    // ─── Message Router ─────────────────────────────────────────────────

    /**
     * Central dispatcher for every message the webview can send.
     * Each branch matches a `command` from the shared message protocol.
     */
    private async _handleMessage(message: unknown): Promise<void> {
        if (!this._isRecord(message) || typeof message.command !== 'string') {
            console.warn('[AI Builder] Ignored malformed webview message.');
            return;
        }

        switch (message.command) {

            // ── Initialisation ──────────────────────────────────────────
            case 'ready':
            case 'loadAllData': {
                const allData = this._storage.getAllData();
                this.postMessage({ command: 'allDataLoaded', data: allData });
                break;
            }

            // ── Persist a single data key ───────────────────────────────
            case 'saveData': {
                const key = typeof message.key === 'string' ? message.key : '';
                try {
                    if (!this._isDataKey(key)) {
                        throw new Error(`Unsupported storage key: ${key || '<missing>'}`);
                    }
                    const data = message.data;
                    await this._saveByKey(key, data);
                    this.postMessage({ command: 'dataSaved', key, success: true });
                } catch (err) {
                    console.error(`[AI Builder] Failed to save "${key}":`, err);
                    this.postMessage({ command: 'dataSaved', key, success: false });
                }
                break;
            }

            // ── Load a single data key ──────────────────────────────────
            case 'loadData': {
                const key = typeof message.key === 'string' ? message.key : '';
                if (!this._isDataKey(key)) {
                    console.warn(`[AI Builder] Ignored unsupported storage key: "${key}"`);
                    this.postMessage({ command: 'dataLoaded', key, data: null });
                    break;
                }
                const data = this._loadByKey(key);
                this.postMessage({ command: 'dataLoaded', key, data });
                break;
            }

            // ── Run a command in the integrated terminal ────────────────
            case 'runTerminalCommand': {
                const commandText =
                    typeof message.commandText === 'string'
                        ? message.commandText.trim()
                        : '';
                const label =
                    typeof message.label === 'string'
                        ? message.label.trim()
                        : commandText;
                if (!commandText) {
                    console.warn('[AI Builder] Ignored empty terminal command.');
                    break;
                }
                const terminal = this._getOrCreateTerminal();
                terminal.show(/* preserveFocus */ true);
                terminal.sendText(commandText);
                vscode.window.showInformationMessage(
                    `Running: ${label || commandText}`,
                );
                break;
            }

            // ── Return workspace metadata ───────────────────────────────
            case 'getWorkspaceInfo': {
                const folders = vscode.workspace.workspaceFolders ?? [];
                const name =
                    folders.length > 0
                        ? folders[0].name
                        : 'No workspace open';
                this.postMessage({
                    command: 'workspaceInfo',
                    data: { name, folderCount: folders.length },
                });
                break;
            }

            // ── Copy text to system clipboard ───────────────────────────
            case 'copyToClipboard': {
                const text = typeof message.text === 'string' ? message.text : '';
                await vscode.env.clipboard.writeText(text);
                vscode.window.showInformationMessage('Copied to clipboard.');
                break;
            }

            // ── Show a VS Code notification ─────────────────────────────
            case 'showMessage': {
                const msgType = message.msgType;
                const text = typeof message.text === 'string' ? message.text : '';
                if (!text) {
                    break;
                }
                switch (msgType) {
                    case 'warning':
                        vscode.window.showWarningMessage(text);
                        break;
                    case 'error':
                        vscode.window.showErrorMessage(text);
                        break;
                    case 'info':
                    default:
                        vscode.window.showInformationMessage(text);
                        break;
                }
                break;
            }

            default:
                console.warn(
                    `[AI Builder] Unknown webview command: "${message.command}"`,
                );
        }
    }

    // ─── Storage Helpers ────────────────────────────────────────────────

    /**
     * Persist data for a known key using the typed StorageService methods.
     */
    private async _saveByKey(key: DataKey, data: unknown): Promise<void> {
        switch (key) {
            case 'prompts':
                await this._storage.savePrompts(this._requireArray<Prompt>(key, data));
                break;
            case 'tasks':
                await this._storage.saveTasks(this._requireArray<Task>(key, data));
                break;
            case 'notes':
                await this._storage.saveNotes(this._requireArray<Note>(key, data));
                break;
            case 'shortcuts':
                await this._storage.saveShortcuts(this._requireArray<Shortcut>(key, data));
                break;
            case 'projectMemory':
                await this._storage.saveProjectMemory(this._requireArray<MemoryEntry>(key, data));
                break;
            case 'sessionState':
                await this._storage.saveSessionState(this._requireSessionState(data));
                break;
        }
    }

    /**
     * Load data for a known key using the typed StorageService methods.
     */
    private _loadByKey(key: DataKey): unknown {
        switch (key) {
            case 'prompts':
                return this._storage.getPrompts();
            case 'tasks':
                return this._storage.getTasks();
            case 'notes':
                return this._storage.getNotes();
            case 'shortcuts':
                return this._storage.getShortcuts();
            case 'projectMemory':
                return this._storage.getProjectMemory();
            case 'sessionState':
                return this._storage.getSessionState();
        }
    }

    private _isDataKey(key: string): key is DataKey {
        return DATA_KEYS.has(key as DataKey);
    }

    private _isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }

    private _requireArray<T>(key: DataKey, data: unknown): T[] {
        if (!Array.isArray(data)) {
            throw new Error(`Expected "${key}" to be an array.`);
        }
        return data as T[];
    }

    private _requireSessionState(data: unknown): SessionState | null {
        if (data === null || this._isRecord(data)) {
            return data as SessionState | null;
        }
        throw new Error('Expected "sessionState" to be an object or null.');
    }

    // ─── Terminal Management ────────────────────────────────────────────

    /**
     * Return the existing "AI Builder" terminal or create a new one.
     * If the previous terminal was closed (exitStatus is defined), create fresh.
     */
    private _getOrCreateTerminal(): vscode.Terminal {
        if (this._terminal && this._terminal.exitStatus === undefined) {
            return this._terminal;
        }
        this._terminal = vscode.window.createTerminal('AI Builder');
        return this._terminal;
    }

    // ─── HTML Generation ────────────────────────────────────────────────

    /**
     * Build the full HTML document that is loaded into the sidebar webview.
     *
     * Security:
     * - A unique nonce is generated per render and applied to the CSP header
     *   and every `<script>` tag so only our own scripts can execute.
     * - `localResourceRoots` (set in `resolveWebviewView`) further restricts
     *   which files the webview may load.
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Generate a cryptographic nonce for the Content-Security-Policy
        const nonce = this._getNonce();

        // ── Resource URIs ───────────────────────────────────────────────
        // CSS
        const mainCssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview', 'styles', 'main.css'),
        );

        // JS — main app entry
        const appJsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview', 'scripts', 'app.js'),
        );

        // JS — feature modules
        const promptsJsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview', 'scripts', 'promptLibrary.js'),
        );
        const tasksJsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview', 'scripts', 'taskManager.js'),
        );
        const notesJsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview', 'scripts', 'notes.js'),
        );
        const shortcutsJsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview', 'scripts', 'terminalShortcuts.js'),
        );
        const memoryJsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview', 'scripts', 'projectMemory.js'),
        );
        const orchestratorJsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview', 'scripts', 'orchestrator.js'),
        );
        const gitManagerJsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview', 'scripts', 'gitManager.js'),
        );

        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!--
        Content-Security-Policy:
        - default-src 'none'        → block everything by default
        - style-src   webview URI   → only our own CSS
        - script-src  nonce-based   → only scripts with the matching nonce
        - font-src    webview URI   → allow bundled fonts
        - img-src     webview + https → local & remote images
    -->
    <meta
        http-equiv="Content-Security-Policy"
        content="
            default-src 'none';
            style-src ${webview.cspSource} 'unsafe-inline';
            script-src 'nonce-${nonce}';
            font-src ${webview.cspSource};
            img-src ${webview.cspSource} https: data:;
        "
    />

    <link rel="stylesheet" href="${mainCssUri}" />
    <title>AI Builder Workspace</title>
</head>
<body>
    <!-- Main application container — JS renders into this node -->
    <div id="app"></div>

    <!-- App helpers first, then feature modules that depend on them -->
    <script nonce="${nonce}" src="${appJsUri}"></script>
    <script nonce="${nonce}" src="${promptsJsUri}"></script>
    <script nonce="${nonce}" src="${tasksJsUri}"></script>
    <script nonce="${nonce}" src="${notesJsUri}"></script>
    <script nonce="${nonce}" src="${shortcutsJsUri}"></script>
    <script nonce="${nonce}" src="${memoryJsUri}"></script>
    <script nonce="${nonce}" src="${orchestratorJsUri}"></script>
    <script nonce="${nonce}" src="${gitManagerJsUri}"></script>
</body>
</html>`;
    }

    /**
     * Generate a random nonce string (32 hex characters).
     * Used to lock down inline/external script execution via CSP.
     */
    private _getNonce(): string {
        return randomBytes(16).toString('hex');
    }
}

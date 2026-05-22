/**
 * commands/index.ts
 *
 * Registers all VS Code commands for the AI Builder Workspace extension.
 * Each command is self-contained: it gathers user input via VS Code's
 * built-in UI (InputBox, QuickPick), persists data through StorageService,
 * and notifies the sidebar webview so it can refresh.
 */

import * as vscode from 'vscode';
import { StorageService, Prompt, Task } from '../services/StorageService';
import { SidebarProvider } from '../SidebarProvider';

/**
 * Generate a simple unique ID (timestamp + random suffix).
 * Good enough for local-only, non-cryptographic use.
 */
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Register every command the extension exposes and push their disposables
 * into the extension context so they are cleaned up automatically.
 *
 * @param context          - The extension context (for subscriptions).
 * @param storage          - The StorageService instance for persistence.
 * @param sidebarProvider  - The SidebarProvider so we can post refresh messages.
 */
export function registerCommands(
    context: vscode.ExtensionContext,
    storage: StorageService,
    sidebarProvider: SidebarProvider,
): void {

    // ── aiBuilder.openSidebar ───────────────────────────────────────────
    // Focuses the sidebar webview panel in the activity bar.
    const openSidebar = vscode.commands.registerCommand(
        'aiBuilder.openSidebar',
        async () => {
            try {
                await vscode.commands.executeCommand('aiBuilderWorkspace.sidebar.focus');
            } catch (err) {
                vscode.window.showErrorMessage(
                    `Failed to open AI Builder sidebar: ${err instanceof Error ? err.message : String(err)}`,
                );
            }
        },
    );

    // ── aiBuilder.addPrompt ─────────────────────────────────────────────
    // Walks the user through creating a new prompt via two InputBoxes,
    // saves it, and tells the sidebar to refresh.
    const addPrompt = vscode.commands.registerCommand(
        'aiBuilder.addPrompt',
        async () => {
            try {
                // Step 1 – prompt title
                const title = await vscode.window.showInputBox({
                    title: 'New Prompt — Title',
                    prompt: 'Enter a title for the prompt',
                    placeHolder: 'e.g. Code Review Checklist',
                    ignoreFocusOut: true,
                });
                if (!title) {
                    return; // user cancelled
                }

                // Step 2 – prompt content
                const content = await vscode.window.showInputBox({
                    title: 'New Prompt — Content',
                    prompt: 'Enter the prompt content / template text',
                    placeHolder: 'e.g. Review the following code for…',
                    ignoreFocusOut: true,
                });
                if (!content) {
                    return; // user cancelled
                }

                // Build and persist the new prompt
                const newPrompt: Prompt = {
                    id: generateId(),
                    title,
                    category: 'general',
                    content,
                    createdAt: new Date().toISOString(),
                };

                const prompts = storage.getPrompts();
                prompts.push(newPrompt);
                await storage.savePrompts(prompts);

                // Notify the webview so it picks up the new data
                sidebarProvider.postMessage({
                    command: 'allDataLoaded',
                    data: storage.getAllData(),
                });

                vscode.window.showInformationMessage(`Prompt "${title}" saved.`);
            } catch (err) {
                vscode.window.showErrorMessage(
                    `Failed to add prompt: ${err instanceof Error ? err.message : String(err)}`
                );
            }
        },
    );

    // ── aiBuilder.addTask ───────────────────────────────────────────────
    // Walks the user through creating a new task via an InputBox (title)
    // and a QuickPick (priority), saves it, and refreshes the sidebar.
    const addTask = vscode.commands.registerCommand(
        'aiBuilder.addTask',
        async () => {
            try {
                // Step 1 – task title
                const title = await vscode.window.showInputBox({
                    title: 'New Task — Title',
                    prompt: 'Enter a title for the task',
                    placeHolder: 'e.g. Implement dark mode',
                    ignoreFocusOut: true,
                });
                if (!title) {
                    return; // user cancelled
                }

                // Step 2 – priority
                const priorityPick = await vscode.window.showQuickPick(
                    [
                        { label: '🔴 High', value: 'high' as const },
                        { label: '🟡 Medium', value: 'medium' as const },
                        { label: '🟢 Low', value: 'low' as const },
                    ],
                    {
                        title: 'New Task — Priority',
                        placeHolder: 'Select a priority level',
                        ignoreFocusOut: true,
                    },
                );
                if (!priorityPick) {
                    return; // user cancelled
                }

                // Determine the next order value (append to end)
                const existingTasks = storage.getTasks();
                const maxOrder = existingTasks.reduce(
                    (max, t) => Math.max(max, t.order),
                    -1,
                );

                const newTask: Task = {
                    id: generateId(),
                    title,
                    description: '',
                    priority: priorityPick.value,
                    status: 'todo',
                    order: maxOrder + 1,
                    createdAt: new Date().toISOString(),
                };

                existingTasks.push(newTask);
                await storage.saveTasks(existingTasks);

                // Notify the webview so it picks up the new data
                sidebarProvider.postMessage({
                    command: 'allDataLoaded',
                    data: storage.getAllData(),
                });

                vscode.window.showInformationMessage(`Task "${title}" added.`);
            } catch (err) {
                vscode.window.showErrorMessage(
                    `Failed to add task: ${err instanceof Error ? err.message : String(err)}`
                );
            }
        },
    );

    // ── aiBuilder.runShortcut ───────────────────────────────────────────
    // Shows a QuickPick of saved shortcuts, then runs the chosen command
    // in a VS Code integrated terminal.
    const runShortcut = vscode.commands.registerCommand(
        'aiBuilder.runShortcut',
        async () => {
            try {
                const shortcuts = storage.getShortcuts();

                if (shortcuts.length === 0) {
                    vscode.window.showInformationMessage(
                        'No shortcuts saved yet. Add one from the sidebar first.',
                    );
                    return;
                }

                // Build QuickPick items
                const items = shortcuts.map((s) => ({
                    label: s.label,
                    description: s.command,
                    shortcutId: s.id,
                }));

                const picked = await vscode.window.showQuickPick(items, {
                    title: 'Run Shortcut',
                    placeHolder: 'Select a shortcut to run',
                });
                if (!picked) {
                    return; // user cancelled
                }

                // Execute in an integrated terminal
                const terminal =
                    vscode.window.activeTerminal ??
                    vscode.window.createTerminal('AI Builder');
                terminal.show(/* preserveFocus */ false);
                terminal.sendText(picked.description ?? '');

                // Update lastRun timestamp on the shortcut
                const updated = shortcuts.map((s) =>
                    s.id === picked.shortcutId
                        ? { ...s, lastRun: new Date().toISOString() }
                        : s,
                );
                await storage.saveShortcuts(updated);

                vscode.window.showInformationMessage(
                    `Running shortcut: ${picked.label}`,
                );
            } catch (err) {
                vscode.window.showErrorMessage(
                    `Failed to run shortcut: ${err instanceof Error ? err.message : String(err)}`
                );
            }
        },
    );

    // ── aiBuilder.exportMemory ──────────────────────────────────────────
    // Loads project memory, formats it as human-readable text, copies it
    // to the clipboard, and shows a confirmation message.
    const exportMemory = vscode.commands.registerCommand(
        'aiBuilder.exportMemory',
        async () => {
            try {
                const memory = storage.getProjectMemory();

                if (memory.length === 0) {
                    vscode.window.showInformationMessage(
                        'Project memory is empty — nothing to export.',
                    );
                    return;
                }

                // Group entries by category for readability
                const grouped = memory.reduce<Record<string, typeof memory>>(
                    (acc, entry) => {
                        const cat = entry.category || 'Uncategorised';
                        if (!acc[cat]) {
                            acc[cat] = [];
                        }
                        acc[cat].push(entry);
                        return acc;
                    },
                    {},
                );

                // Build a plain-text representation
                const lines: string[] = [
                    '# AI Builder — Project Memory Export',
                    `# Exported: ${new Date().toLocaleString()}`,
                    '',
                ];

                for (const [category, entries] of Object.entries(grouped)) {
                    lines.push(`## ${category}`);
                    for (const entry of entries) {
                        lines.push(`  ${entry.key}: ${entry.value}`);
                    }
                    lines.push('');
                }

                const text = lines.join('\n');
                await vscode.env.clipboard.writeText(text);

                vscode.window.showInformationMessage(
                    `Copied ${memory.length} memory entries to clipboard.`,
                );
            } catch (err) {
                vscode.window.showErrorMessage(
                    `Failed to export memory: ${err instanceof Error ? err.message : String(err)}`
                );
            }
        },
    );

    // Push all command disposables into the extension context
    context.subscriptions.push(
        openSidebar,
        addPrompt,
        addTask,
        runShortcut,
        exportMemory,
    );
}

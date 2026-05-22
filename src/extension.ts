/**
 * extension.ts
 *
 * Entry point for the AI Builder Workspace VS Code extension.
 * Keeps the activation logic thin — all real work is delegated to
 * StorageService, SidebarProvider, and the command registrations.
 */

import * as vscode from 'vscode';
import { StorageService } from './services/StorageService';
import { SidebarProvider } from './SidebarProvider';
import { registerCommands } from './commands/index';

/**
 * Called by VS Code when the extension is activated.
 *
 * Activation events are configured in package.json (e.g. `onView:aiBuilderWorkspace.sidebar`).
 *
 * @param context - The extension context provided by VS Code.
 */
export function activate(context: vscode.ExtensionContext): void {
    // 1. Initialise the storage layer (wraps globalState)
    const storage = new StorageService(context);

    // 2. Create the sidebar webview provider
    const sidebarProvider = new SidebarProvider(context.extensionUri, storage);
    context.subscriptions.push(sidebarProvider);

    // 3. Register the webview view provider so VS Code knows how to render the sidebar
    const sidebarDisposable = vscode.window.registerWebviewViewProvider(
        SidebarProvider.viewType,
        sidebarProvider,
    );
    context.subscriptions.push(sidebarDisposable);

    // 4. Register all commands (they also push their own disposables)
    registerCommands(context, storage, sidebarProvider);

}

/**
 * Called by VS Code when the extension is deactivated.
 * Cleanup is handled automatically via `context.subscriptions`.
 */
export function deactivate(): void {
    // Nothing to do — all disposables are managed by the extension context.
}

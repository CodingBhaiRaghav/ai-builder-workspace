/**
 * StorageService.ts
 * 
 * A typed wrapper around vscode.ExtensionContext.globalState that provides
 * strongly-typed accessors for every data model used by AI Builder Workspace.
 * All keys are namespaced with an 'aiBuilder.' prefix to avoid collisions
 * with other extensions sharing the same global state store.
 */

import * as vscode from 'vscode';

// ─── Data Model Interfaces ──────────────────────────────────────────────────

/** A reusable AI prompt template. */
export interface Prompt {
    id: string;
    title: string;
    category: string;
    content: string;
    createdAt: string;
}

/** A trackable task with priority and status. */
export interface Task {
    id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    status: 'todo' | 'in-progress' | 'done';
    order: number;
    createdAt: string;
}

/** A free-form note that can be pinned for quick access. */
export interface Note {
    id: string;
    title: string;
    content: string;
    pinned: boolean;
    createdAt: string;
    updatedAt: string;
}

/** A terminal shortcut – a saved command that can be run with one click. */
export interface Shortcut {
    id: string;
    label: string;
    command: string;
    lastRun: string | null;
}

/** A key-value entry in the project memory store. */
export interface MemoryEntry {
    id: string;
    key: string;
    value: string;
    category: string;
}

/** A step in the orchestrator plan */
export interface PlanStep {
    id: string;
    description: string;
    command?: string;
    status: 'pending' | 'running' | 'done' | 'failed';
    output?: string;
}

/** Retains orchestrator execution history across sessions */
export interface SessionState {
    purpose: string | null;
    steps: PlanStep[];
    currentStepIndex: number;
    updatedAt: string;
}

// ─── Storage Key Constants ──────────────────────────────────────────────────

/** Namespace prefix applied to every globalState key. */
const KEY_PREFIX = 'aiBuilder.';

const KEYS = {
    prompts: `${KEY_PREFIX}prompts`,
    tasks: `${KEY_PREFIX}tasks`,
    notes: `${KEY_PREFIX}notes`,
    shortcuts: `${KEY_PREFIX}shortcuts`,
    projectMemory: `${KEY_PREFIX}projectMemory`,
    sessionState: `${KEY_PREFIX}sessionState`,
} as const;

const DEFAULT_CREATED_AT = '2026-01-01T00:00:00.000Z';

const DEFAULT_PROMPTS: Prompt[] = [
    {
        id: 'starter-generate-function',
        title: 'Generate Function',
        category: 'codegen',
        content: 'Generate a {{language}} function that {{description}}',
        createdAt: DEFAULT_CREATED_AT,
    },
    {
        id: 'starter-debug-error',
        title: 'Debug Error',
        category: 'debug',
        content: 'Analyze this error and suggest fixes: {{error_message}}',
        createdAt: DEFAULT_CREATED_AT,
    },
    {
        id: 'starter-refactor-code',
        title: 'Refactor Code',
        category: 'refactor',
        content: 'Refactor the following code to improve {{aspect}}: {{code}}',
        createdAt: DEFAULT_CREATED_AT,
    },
    {
        id: 'starter-explain-concept',
        title: 'Explain Concept',
        category: 'explain',
        content: 'Explain how {{concept}} works in {{context}}',
        createdAt: DEFAULT_CREATED_AT,
    },
    {
        id: 'starter-code-review',
        title: 'Code Review',
        category: 'custom',
        content: 'Review this code for {{criteria}}: {{code}}',
        createdAt: DEFAULT_CREATED_AT,
    },
];

const DEFAULT_SHORTCUTS: Shortcut[] = [
    {
        id: 'starter-install-dependencies',
        label: 'Install Dependencies',
        command: 'npm install',
        lastRun: null,
    },
    {
        id: 'starter-compile-extension',
        label: 'Compile Extension',
        command: 'npm run compile',
        lastRun: null,
    },
    {
        id: 'starter-watch-compiler',
        label: 'Watch Compiler',
        command: 'npm run watch',
        lastRun: null,
    },
    {
        id: 'starter-lint',
        label: 'Lint',
        command: 'npm run lint',
        lastRun: null,
    },
    {
        id: 'starter-git-status',
        label: 'Git Status',
        command: 'git status',
        lastRun: null,
    },
];

// ─── StorageService Class ───────────────────────────────────────────────────

/**
 * Provides a clean, type-safe API over `vscode.ExtensionContext.globalState`.
 *
 * Usage:
 * ```ts
 * const storage = new StorageService(context);
 * const tasks = storage.getTasks();
 * await storage.saveTasks([...tasks, newTask]);
 * ```
 */
export class StorageService {
    private readonly state: vscode.Memento;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.state = context.globalState;
    }

    // ── Generic accessors ───────────────────────────────────────────────

    /**
     * Retrieve a value from global state.
     * @param key   - The raw (un-prefixed) storage key.
     * @param defaultValue - Returned when the key does not exist.
     */
    get<T>(key: string, defaultValue: T): T {
        return this.state.get<T>(key, defaultValue);
    }

    /**
     * Persist a value to global state.
     * @param key   - The raw (un-prefixed) storage key.
     * @param value - Any JSON-serialisable value.
     */
    set(key: string, value: any): Thenable<void> {
        return this.state.update(key, value);
    }

    // ── Prompts ─────────────────────────────────────────────────────────

    /** Return saved prompts, or starter prompts until the user saves changes. */
    getPrompts(): Prompt[] {
        return this.state.get<Prompt[]>(KEYS.prompts, this.cloneArray(DEFAULT_PROMPTS));
    }

    /** Overwrite the entire prompts collection. */
    savePrompts(prompts: Prompt[]): Thenable<void> {
        return this.state.update(KEYS.prompts, prompts);
    }

    // ── Tasks ───────────────────────────────────────────────────────────

    /** Return all saved tasks, or an empty array if none exist. */
    getTasks(): Task[] {
        return this.state.get<Task[]>(KEYS.tasks, []);
    }

    /** Overwrite the entire tasks collection. */
    saveTasks(tasks: Task[]): Thenable<void> {
        return this.state.update(KEYS.tasks, tasks);
    }

    // ── Notes ───────────────────────────────────────────────────────────

    /** Return all saved notes, or an empty array if none exist. */
    getNotes(): Note[] {
        return this.state.get<Note[]>(KEYS.notes, []);
    }

    /** Overwrite the entire notes collection. */
    saveNotes(notes: Note[]): Thenable<void> {
        return this.state.update(KEYS.notes, notes);
    }

    // ── Shortcuts ───────────────────────────────────────────────────────

    /** Return saved shortcuts, or starter shortcuts until the user saves changes. */
    getShortcuts(): Shortcut[] {
        return this.state.get<Shortcut[]>(KEYS.shortcuts, this.cloneArray(DEFAULT_SHORTCUTS));
    }

    /** Overwrite the entire shortcuts collection. */
    saveShortcuts(shortcuts: Shortcut[]): Thenable<void> {
        return this.state.update(KEYS.shortcuts, shortcuts);
    }

    // ── Project Memory ──────────────────────────────────────────────────

    /** Return all project memory entries, or an empty array if none exist. */
    getProjectMemory(): MemoryEntry[] {
        return this.state.get<MemoryEntry[]>(KEYS.projectMemory, []);
    }

    /** Overwrite the entire project memory collection. */
    saveProjectMemory(entries: MemoryEntry[]): Thenable<void> {
        return this.state.update(KEYS.projectMemory, entries);
    }

    // ── Session State ───────────────────────────────────────────────────

    /** Return the active orchestration session state, or null. */
    getSessionState(): SessionState | null {
        return this.state.get<SessionState | null>(KEYS.sessionState, null);
    }

    /** Save the active orchestration session state. */
    saveSessionState(session: SessionState | null): Thenable<void> {
        return this.state.update(KEYS.sessionState, session);
    }

    // ── Bulk access ─────────────────────────────────────────────────────

    /**
     * Return every data collection in a single object.
     * Useful for hydrating the webview on first load.
     */
    getAllData(): {
        prompts: Prompt[];
        tasks: Task[];
        notes: Note[];
        shortcuts: Shortcut[];
        projectMemory: MemoryEntry[];
        sessionState: SessionState | null;
    } {
        return {
            prompts: this.getPrompts(),
            tasks: this.getTasks(),
            notes: this.getNotes(),
            shortcuts: this.getShortcuts(),
            projectMemory: this.getProjectMemory(),
            sessionState: this.getSessionState(),
        };
    }

    private cloneArray<T extends object>(items: T[]): T[] {
        return items.map((item) => ({ ...item }));
    }
}

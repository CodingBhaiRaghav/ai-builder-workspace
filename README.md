# AI Builder Workspace

> **A VS Code extension that helps developers organize AI-assisted coding workflows.**

AI Builder Workspace adds a powerful sidebar panel with tools for planning workflows, managing prompts, tasks, notes, terminal shortcuts, project context, and Git helpers — everything you need to streamline your AI-powered development process.

---

## ✨ Features

### 🤖 Goal-Driven Plan
- Generate a lightweight workflow from a plain-language goal
- Reuse saved terminal shortcuts and project memory as context
- Track step completion across sessions

### 💡 Prompt Library
- Save and organize reusable AI prompt templates
- Categorize prompts: Code Gen, Debug, Refactor, Explain, Custom
- Template variable support with `{{variable}}` highlighting
- One-click copy to clipboard
- Search and filter by category
- Ships with 5 starter prompts

### ✅ Task Manager
- Track coding tasks with priorities (High / Medium / Low)
- Status workflow: Todo → In Progress → Done
- Visual progress bar with completion percentage
- Filter by status and priority
- Drag-reorder with up/down controls

### 📝 Notes
- Quick-capture notes with timestamps
- Pin important notes to the top
- Basic markdown rendering (bold, italic, code, lists)
- Search across all notes
- Auto-tracked created/modified dates

### ⚡ Terminal Shortcuts
- Save frequently-used terminal commands
- One-click execution in VS Code's integrated terminal
- Tracks last-run timestamps
- Run history of recent executions
- Preset shortcuts: `npm install`, `npm run dev`, `git status`, and more

### 🧠 Project Memory
- Store key-value context about your project
- Categories: Architecture, Dependencies, Conventions, API Info, Notes
- Export all context as formatted text for AI tools
- Workspace info display
- Copy-all for quick context sharing

### 🌿 Git Helpers
- Check workspace status from the sidebar
- Stash changes before switching versions
- Print recent commit history in the terminal
- Checkout a selected commit, tag, or branch with basic ref validation

---

## 🚀 Getting Started

### Prerequisites
- [Visual Studio Code](https://code.visualstudio.com/) v1.85.0 or later
- [Node.js](https://nodejs.org/) v18 or later

### Development Setup

1. **Clone and install dependencies:**
   ```bash
   cd "E:\my app"
   npm install
   ```

2. **Compile TypeScript:**
   ```bash
   npm run compile
   ```

3. **Run all checks:**
   ```bash
   npm run check
   ```

4. **Run the extension:**
   - Press `F5` in VS Code (with this folder open)
   - A new Extension Development Host window will open
   - Click the **brain icon** in the Activity Bar to open the sidebar

### Watch Mode (for development)
```bash
npm run watch
```

---

## 📁 Project Structure

```
├── .vscode/               # VS Code debug & build config
│   ├── launch.json
│   └── tasks.json
├── src/                   # TypeScript extension host code
│   ├── extension.ts       # Entry point (thin)
│   ├── SidebarProvider.ts # WebviewViewProvider
│   ├── commands/
│   │   └── index.ts       # Command registrations
│   └── services/
│       └── StorageService.ts  # Persistence layer
├── webview/               # Frontend UI (HTML/CSS/JS)
│   ├── index.html         # Template reference
│   ├── styles/
│   │   └── main.css       # Complete stylesheet
│   └── scripts/
│       ├── app.js             # App orchestrator
│       ├── promptLibrary.js   # Prompt Library module
│       ├── taskManager.js     # Task Manager module
│       ├── notes.js           # Notes module
│       ├── terminalShortcuts.js # Terminal Shortcuts module
│       ├── projectMemory.js   # Project Memory module
│       ├── orchestrator.js    # Goal planner module
│       └── gitManager.js      # Git helper module
├── resources/
│   └── icon.svg           # Activity Bar icon
├── out/                   # Compiled JS output
├── package.json           # Extension manifest
└── tsconfig.json          # TypeScript configuration
```

---

## 🎨 UI & Theming

The extension uses VS Code's CSS variables (`--vscode-*`) throughout, so it automatically adapts to:
- **Dark themes** (default VS Code Dark+, GitHub Dark, etc.)
- **Light themes** (VS Code Light+, Quiet Light, etc.)
- **High contrast themes**

---

## ⌨️ Commands

| Command | Description |
|---------|-------------|
| `AI Builder: Open Sidebar` | Focus the sidebar panel |
| `AI Builder: Add Prompt` | Quick-add a prompt via input boxes |
| `AI Builder: Add Task` | Quick-add a task with priority picker |
| `AI Builder: Run Terminal Shortcut` | Pick and run a saved shortcut |
| `AI Builder: Export Project Memory` | Copy all memory to clipboard |

Access all commands via `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) and type "AI Builder".

---

## 🏗 Architecture

The extension follows a **modular, layered architecture**:

1. **Extension Host** (TypeScript) — VS Code API interactions, storage, commands
2. **Webview** (HTML/CSS/JS) — UI rendering, user interactions
3. **Message Protocol** — Bidirectional `postMessage` communication between layers

Data persists via VS Code's `globalState` API, surviving editor restarts and extension updates.

---

## 📦 Packaging

To create a `.vsix` package for distribution:

```bash
npx @vscode/vsce package
```

---

## 📄 License

MIT

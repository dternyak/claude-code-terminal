# Claude Code Terminal

An embedded terminal plugin for Obsidian that integrates with [Claude Code](https://docs.anthropic.com/en/docs/claude-code), Anthropic's AI coding assistant.

![Obsidian](https://img.shields.io/badge/Obsidian-1.5.0+-purple)
![Platform](https://img.shields.io/badge/Platform-Desktop%20Only-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Floating Terminal**: Quick-access popup window (Cmd/Ctrl+Shift+`)
- **Sidebar Integration**: Dock to Obsidian's native right sidebar
- **Auto-launch Claude**: Optionally start Claude Code automatically when terminal opens
- **Theme Matching**: Terminal colors adapt to your Obsidian theme
- **Resizable & Draggable**: Floating window can be positioned and resized
- **Full PTY Support**: Real terminal emulation via node-pty

## Requirements

- **Obsidian** 1.5.0 or later (desktop only)
- **Claude Code CLI** installed and configured ([installation guide](https://docs.anthropic.com/en/docs/claude-code))
- **Node.js** 18+ (for building from source)
- **Build tools** for compiling native modules (Xcode Command Line Tools on macOS, build-essential on Linux, Visual Studio Build Tools on Windows)

## Installation

### From Source (Recommended)

This plugin uses native modules that need to be compiled for your system's Electron version.

```bash
# Clone into your vault's plugins folder
cd /path/to/your/vault/.obsidian/plugins
git clone https://github.com/dternyak/claude-code-terminal.git
cd claude-code-terminal

# Install dependencies
npm install

# Rebuild node-pty for Obsidian's Electron version
npm run rebuild:electron

# Build the plugin
npm run build
```

Then restart Obsidian and enable "Claude Terminal" in Settings > Community plugins.

### Electron Version Note

The `rebuild:electron` script is configured for Electron 37.3.1 (Obsidian 1.9.x). If you're using a different Obsidian version, you may need to adjust the Electron version in package.json:

```bash
# Check Obsidian's Electron version
# In Obsidian: Open Developer Tools (Cmd+Option+I) > Console > process.versions.electron

# Update rebuild command if needed
npm run rebuild:electron -- -v YOUR_ELECTRON_VERSION
```

## Usage

### Toggle Terminal

- **Keyboard**: `Cmd+Shift+\`` (Mac) or `Ctrl+Shift+\`` (Windows/Linux)
- **Ribbon**: Click the terminal icon in the left sidebar
- **Command Palette**: "Toggle Claude Terminal (Floating)"

### Floating Window Controls

| Button | Action |
|--------|--------|
| + | Clear terminal |
| Panel icon | Dock to right sidebar |
| - | Hide (terminal keeps running) |
| x | Close and terminate session |

### Sidebar Mode

When docked in the right sidebar, use the "..." menu for:
- **Undock to floating window** - Return to floating mode
- **Clear terminal** - Clear the screen

## Configuration

Open Settings > Claude Terminal:

| Setting | Description | Default |
|---------|-------------|---------|
| Shell path | Path to shell executable | `/bin/zsh` (macOS/Linux) or `powershell.exe` (Windows) |
| Auto-launch Claude | Run `claude` command on terminal open | Enabled |
| Font size | Terminal font size | 13px |

## Claude Code Setup

For the best experience with Claude Code in your vault, copy the example files from the `examples/` folder:

### 1. Create a CLAUDE.md file (recommended)

Copy `examples/CLAUDE.md` to your vault root. This gives Claude Code instructions for:
- Thorough file searching (handles emoji prefixes, special characters)
- Preserving heading structure when editing
- Archiving instead of deleting files
- Understanding your vault conventions

```bash
cp examples/CLAUDE.md /path/to/your/vault/CLAUDE.md
```

### 2. Configure default permissions (recommended)

Copy `examples/settings.local.json` to `.claude/` in your vault root:

```bash
mkdir -p /path/to/your/vault/.claude
cp examples/settings.local.json /path/to/your/vault/.claude/settings.local.json
```

This grants Claude Code full access to your vault without permission prompts.

## Development

```bash
# Watch mode (auto-rebuild on changes)
npm run dev

# Production build
npm run build

# Rebuild native modules
npm run rebuild:electron
```

### Project Structure

```
claude-terminal/
├── src/
│   └── main.ts         # Plugin source code
├── manifest.json       # Obsidian plugin manifest
├── package.json        # Dependencies & scripts
├── esbuild.config.mjs  # Build configuration
├── tsconfig.json       # TypeScript config
├── styles.css          # Plugin styles
└── main.js             # Built output (generated)
```

## Troubleshooting

### "Error: Failed to start terminal"

The node-pty native module may not be compiled for your Electron version:

```bash
npm run rebuild:electron
```

### Terminal shows garbled characters

Ensure styles.css is loaded. The plugin includes required xterm.js styles.

### Claude command not found

Make sure Claude Code is installed and in your PATH:

```bash
# Check if claude is available
which claude

# If not, install it
npm install -g @anthropic-ai/claude-code
```

### Permission prompts keep appearing

Add the specific commands to your `.claude/settings.local.json` permissions array, or select "Yes, and always allow" when prompted.

## Credits

- [xterm.js](https://xtermjs.org/) - Terminal emulator
- [node-pty](https://github.com/microsoft/node-pty) - PTY bindings
- Inspired by [obsidian-terminal-sidebar](https://github.com/deltartificial/obsidian-terminal-sidebar)

## License

MIT License - see [LICENSE](LICENSE) for details.

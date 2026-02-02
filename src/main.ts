import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, ItemView, Menu, FileSystemAdapter, setIcon } from "obsidian";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import type { IPty } from "node-pty";
import * as path from "path";

// Use window.require for native modules in Electron
// In Electron, window has a require property for Node.js modules
const electronRequire = (window as unknown as { require: NodeJS.Require }).require;

const VIEW_TYPE_CLAUDE_TERMINAL = "claude-terminal-view";

interface ClaudeTerminalSettings {
  shellPath: string;
  autoLaunchClaude: boolean;
  fontSize: number;
  floatingWidth: number;
  floatingHeight: number;
}

const DEFAULT_SETTINGS: ClaudeTerminalSettings = {
  shellPath: process.platform === "win32" ? "powershell.exe" : process.env.SHELL || "/bin/zsh",
  autoLaunchClaude: true,
  fontSize: 13,
  floatingWidth: 500,
  floatingHeight: 350,
};

class ClaudeTerminalView extends ItemView {
  private terminal: Terminal | null = null;
  private fitAddon: FitAddon | null = null;
  private ptyProcess: IPty | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private plugin: ClaudeTerminalPlugin;
  private fitDebounceTimer: NodeJS.Timeout | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: ClaudeTerminalPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_CLAUDE_TERMINAL;
  }

  getDisplayText(): string {
    return "Claude terminal";
  }

  getIcon(): string {
    return "terminal";
  }

  async onOpen(): Promise<void> {
    await super.onOpen();
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("claude-terminal-view-container");

    // Create terminal content area
    const content = container.createDiv({ cls: "claude-terminal-content" });

    // Initialize terminal after a short delay to ensure container is ready
    setTimeout(() => {
      this.initializeTerminal(content);
    }, 100);
  }

  // Add menu items to the view's "..." menu
  onPaneMenu(menu: Menu) {
    menu.addItem((item) => {
      item
        .setTitle("Undock to floating window")
        .setIcon("arrow-up-right")
        .onClick(() => this.plugin.undockToFloating());
    });
    menu.addItem((item) => {
      item
        .setTitle("Clear terminal")
        .setIcon("eraser")
        .onClick(() => this.sendClear());
    });
  }

  sendClear() {
    // Send clear command to terminal
    this.ptyProcess?.write("clear\r");
  }

  async onClose(): Promise<void> {
    await super.onClose();
    this.destroyTerminal();
  }

  private getObsidianTheme() {
    const styles = getComputedStyle(document.body);
    return {
      background: styles.getPropertyValue("--background-primary").trim() || "#1e1e1e",
      foreground: styles.getPropertyValue("--text-normal").trim() || "#d4d4d4",
      cursor: styles.getPropertyValue("--text-accent").trim() || "#528bff",
      selectionBackground: styles.getPropertyValue("--text-selection").trim() || "#264f78",
    };
  }

  private initializeTerminal(container: HTMLElement) {
    const theme = this.getObsidianTheme();

    this.terminal = new Terminal({
      fontSize: this.plugin.settings.fontSize,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: theme.background,
        foreground: theme.foreground,
        cursor: theme.cursor,
        selectionBackground: theme.selectionBackground,
      },
      cursorBlink: true,
      cursorStyle: "bar",
      allowTransparency: true,
      scrollback: 10000,
      cols: 80,
      rows: 24,
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    this.terminal.open(container);

    // Fit after DOM is ready
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.fitAddon && this.terminal) {
          this.fitAddon.fit();
          this.startPty();
          this.terminal.focus();
        }
      });
    });

    // Setup resize observer with debounce to prevent scroll jumping
    this.resizeObserver = new ResizeObserver(() => {
      if (this.fitDebounceTimer) clearTimeout(this.fitDebounceTimer);
      this.fitDebounceTimer = setTimeout(() => {
        if (this.fitAddon && this.terminal && this.ptyProcess) {
          this.fitAddon.fit();
          this.terminal.scrollToBottom();
        }
      }, 50);
    });
    this.resizeObserver.observe(container);
  }

  private getPluginPath(): string {
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const basePath = adapter.getBasePath();
    return path.join(basePath, this.app.vault.configDir, "plugins", "claude-terminal");
  }

  private startPty() {
    if (!this.terminal) return;

    try {
      const pluginPath = this.getPluginPath();
      const nodePtyPath = path.join(pluginPath, "node_modules", "node-pty");

      let nodePty;
      try {
        nodePty = electronRequire(nodePtyPath);
      } catch {
        nodePty = electronRequire("node-pty");
      }

      const vaultPath = (this.app.vault.adapter as FileSystemAdapter).getBasePath();

      this.ptyProcess = nodePty.spawn(this.plugin.settings.shellPath, [], {
        name: "xterm-256color",
        cols: this.terminal.cols,
        rows: this.terminal.rows,
        cwd: vaultPath,
        env: {
          ...process.env,
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
        },
      });

      this.ptyProcess!.onData((data: string) => {
        this.terminal?.write(data);
      });

      this.terminal.onData((data: string) => {
        this.ptyProcess?.write(data);
      });

      this.terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        this.ptyProcess?.resize(cols, rows);
      });

      if (this.plugin.settings.autoLaunchClaude) {
        setTimeout(() => {
          this.ptyProcess?.write("clear && claude\r");
        }, 300);
      }
    } catch (error) {
      console.error("Claude Terminal: Failed to start PTY", error);
      this.terminal?.write("\r\n\x1b[31mError: Failed to start terminal.\x1b[0m\r\n");
      this.terminal?.write(`\r\n${error}\r\n`);
    }
  }

  private destroyTerminal() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.ptyProcess) {
      this.ptyProcess.kill();
      this.ptyProcess = null;
    }

    if (this.terminal) {
      this.terminal.dispose();
      this.terminal = null;
    }

    this.fitAddon = null;
  }

  clearTerminal() {
    this.terminal?.clear();
  }

  focusTerminal() {
    this.terminal?.focus();
  }
}

export default class ClaudeTerminalPlugin extends Plugin {
  settings: ClaudeTerminalSettings = DEFAULT_SETTINGS;
  private floatingContainer: HTMLElement | null = null;
  private floatingTerminal: Terminal | null = null;
  private floatingFitAddon: FitAddon | null = null;
  private floatingPtyProcess: IPty | null = null;
  private floatingResizeObserver: ResizeObserver | null = null;
  private isFloatingVisible: boolean = false;
  private floatingFitDebounceTimer: NodeJS.Timeout | null = null;

  async onload() {
    await this.loadSettings();

    // Register the view type for sidebar
    this.registerView(VIEW_TYPE_CLAUDE_TERMINAL, (leaf) => new ClaudeTerminalView(leaf, this));

    // Add ribbon icon
    this.addRibbonIcon("terminal", "Toggle Claude terminal", () => {
      this.toggleFloatingTerminal();
    });

    // Toggle floating terminal
    this.addCommand({
      id: "toggle-claude-terminal",
      name: "Toggle Claude terminal (floating)",
      callback: () => {
        this.toggleFloatingTerminal();
      },
    });

    // Open in right sidebar
    this.addCommand({
      id: "open-claude-terminal-sidebar",
      name: "Open Claude terminal in right sidebar",
      callback: () => {
        void this.openInSidebar();
      },
    });

    // Add settings tab
    this.addSettingTab(new ClaudeTerminalSettingTab(this.app, this));

    // Create floating container
    this.app.workspace.onLayoutReady(() => {
      this.createFloatingContainer();
    });
  }

  onunload() {
    this.destroyFloatingTerminal();
    if (this.floatingContainer) {
      this.floatingContainer.remove();
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async openInSidebar() {
    // Close floating if open
    if (this.isFloatingVisible) {
      this.hideFloatingTerminal();
      this.destroyFloatingTerminal();
    }

    const rightLeaf = this.app.workspace.getRightLeaf(false);
    if (rightLeaf) {
      await rightLeaf.setViewState({
        type: VIEW_TYPE_CLAUDE_TERMINAL,
        active: true,
      });
      await this.app.workspace.revealLeaf(rightLeaf);
    }
  }

  undockToFloating() {
    // Close sidebar view
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CLAUDE_TERMINAL);

    // Open floating terminal
    this.showFloatingTerminal();
  }

  // ========== Floating Terminal ==========

  private createFloatingContainer() {
    this.floatingContainer = document.createElement("div");
    this.floatingContainer.addClass("claude-terminal-floating", "is-hidden");
    this.floatingContainer.style.width = `${this.settings.floatingWidth}px`;
    this.floatingContainer.style.height = `${this.settings.floatingHeight}px`;

    // Header
    const header = this.floatingContainer.createDiv({ cls: "claude-terminal-header" });

    const headerLeft = header.createDiv({ cls: "claude-terminal-header-left" });
    headerLeft.createSpan({ cls: "claude-terminal-title", text: "Claude terminal" });

    const headerRight = header.createDiv({ cls: "claude-terminal-header-right" });

    // Clear button
    const clearBtn = headerRight.createEl("button", { cls: "claude-terminal-btn clickable-icon", attr: { "aria-label": "Clear terminal" } });
    setIcon(clearBtn, "plus");
    clearBtn.title = "Clear terminal";
    clearBtn.addEventListener("click", () => this.floatingPtyProcess?.write("clear\r"));

    // Dock to sidebar button
    const dockBtn = headerRight.createEl("button", { cls: "claude-terminal-btn clickable-icon", attr: { "aria-label": "Open in sidebar" } });
    setIcon(dockBtn, "layout-sidebar-right");
    dockBtn.title = "Open in right sidebar";
    dockBtn.addEventListener("click", () => { void this.openInSidebar(); });

    // Minimize button
    const minBtn = headerRight.createEl("button", { cls: "claude-terminal-btn clickable-icon", attr: { "aria-label": "Hide" } });
    setIcon(minBtn, "minus");
    minBtn.title = "Hide terminal";
    minBtn.addEventListener("click", () => this.hideFloatingTerminal());

    // Close button
    const closeBtn = headerRight.createEl("button", { cls: "claude-terminal-btn clickable-icon claude-terminal-btn-close", attr: { "aria-label": "Close" } });
    setIcon(closeBtn, "x");
    closeBtn.title = "Close and terminate session";
    closeBtn.addEventListener("click", () => {
      this.hideFloatingTerminal();
      this.destroyFloatingTerminal();
    });

    // Content
    this.floatingContainer.createDiv({ cls: "claude-terminal-content" });

    // Resize handle
    const resizeHandle = this.floatingContainer.createDiv({ cls: "claude-terminal-resize" });

    document.body.appendChild(this.floatingContainer);

    this.setupFloatingDrag(header);
    this.setupFloatingResize(resizeHandle);
  }

  private setupFloatingDrag(header: HTMLElement) {
    let isDragging = false;
    let startX: number, startY: number;
    let startRight: number, startBottom: number;

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || !this.floatingContainer) return;
      const deltaX = startX - e.clientX;
      const deltaY = startY - e.clientY;
      this.floatingContainer.style.right = `${Math.max(0, startRight + deltaX)}px`;
      this.floatingContainer.style.bottom = `${Math.max(0, startBottom + deltaY)}px`;
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    header.addEventListener("mousedown", (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".claude-terminal-btn")) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.floatingContainer!.getBoundingClientRect();
      startRight = window.innerWidth - rect.right;
      startBottom = window.innerHeight - rect.bottom;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      e.preventDefault();
    });
  }

  private setupFloatingResize(handle: HTMLElement) {
    let startX: number, startY: number;
    let startWidth: number, startHeight: number;

    const onMouseMove = (e: MouseEvent) => {
      if (!this.floatingContainer) return;
      const deltaX = startX - e.clientX;
      const deltaY = e.clientY - startY;
      const newWidth = Math.min(Math.max(startWidth + deltaX, 300), window.innerWidth * 0.8);
      const newHeight = Math.min(Math.max(startHeight + deltaY, 200), window.innerHeight * 0.8);
      this.floatingContainer.style.width = `${newWidth}px`;
      this.floatingContainer.style.height = `${newHeight}px`;
      this.settings.floatingWidth = newWidth;
      this.settings.floatingHeight = newHeight;
      if (this.floatingFitAddon && this.floatingTerminal) {
        this.floatingFitAddon.fit();
        this.floatingTerminal.scrollToBottom();
      }
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      void this.saveSettings();
    };

    handle.addEventListener("mousedown", (e: MouseEvent) => {
      startX = e.clientX;
      startY = e.clientY;
      startWidth = this.floatingContainer?.offsetWidth || 500;
      startHeight = this.floatingContainer?.offsetHeight || 350;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      e.preventDefault();
    });
  }

  private getObsidianTheme() {
    const styles = getComputedStyle(document.body);
    return {
      background: styles.getPropertyValue("--background-primary").trim() || "#1e1e1e",
      foreground: styles.getPropertyValue("--text-normal").trim() || "#d4d4d4",
      cursor: styles.getPropertyValue("--text-accent").trim() || "#528bff",
      selectionBackground: styles.getPropertyValue("--text-selection").trim() || "#264f78",
    };
  }

  private initializeFloatingTerminal() {
    const content = this.floatingContainer?.querySelector(".claude-terminal-content");
    if (!content) return;

    const theme = this.getObsidianTheme();

    this.floatingTerminal = new Terminal({
      fontSize: this.settings.fontSize,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: theme.background,
        foreground: theme.foreground,
        cursor: theme.cursor,
        selectionBackground: theme.selectionBackground,
      },
      cursorBlink: true,
      cursorStyle: "bar",
      allowTransparency: true,
      scrollback: 10000,
      cols: 80,
      rows: 24,
    });

    this.floatingFitAddon = new FitAddon();
    this.floatingTerminal.loadAddon(this.floatingFitAddon);
    this.floatingTerminal.open(content as HTMLElement);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.floatingFitAddon && this.floatingTerminal) {
          this.floatingFitAddon.fit();
          this.startFloatingPty();
          this.floatingTerminal.focus();
        }
      });
    });

    this.floatingResizeObserver = new ResizeObserver(() => {
      if (this.floatingFitDebounceTimer) clearTimeout(this.floatingFitDebounceTimer);
      this.floatingFitDebounceTimer = setTimeout(() => {
        if (this.floatingFitAddon && this.floatingTerminal && this.floatingPtyProcess) {
          this.floatingFitAddon.fit();
          this.floatingTerminal.scrollToBottom();
        }
      }, 50);
    });
    this.floatingResizeObserver.observe(content);
  }

  private getPluginPath(): string {
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const basePath = adapter.getBasePath();
    return path.join(basePath, this.app.vault.configDir, "plugins", "claude-terminal");
  }

  private startFloatingPty() {
    if (!this.floatingTerminal) return;

    try {
      const pluginPath = this.getPluginPath();
      const nodePtyPath = path.join(pluginPath, "node_modules", "node-pty");

      let nodePty;
      try {
        nodePty = electronRequire(nodePtyPath);
      } catch {
        nodePty = electronRequire("node-pty");
      }

      const vaultPath = (this.app.vault.adapter as FileSystemAdapter).getBasePath();

      this.floatingPtyProcess = nodePty.spawn(this.settings.shellPath, [], {
        name: "xterm-256color",
        cols: this.floatingTerminal.cols,
        rows: this.floatingTerminal.rows,
        cwd: vaultPath,
        env: {
          ...process.env,
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
        },
      });

      this.floatingPtyProcess!.onData((data: string) => {
        this.floatingTerminal?.write(data);
      });

      this.floatingTerminal.onData((data: string) => {
        this.floatingPtyProcess?.write(data);
      });

      this.floatingTerminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        this.floatingPtyProcess?.resize(cols, rows);
      });

      if (this.settings.autoLaunchClaude) {
        setTimeout(() => {
          this.floatingPtyProcess?.write("clear && claude\r");
        }, 300);
      }
    } catch (error) {
      console.error("Claude Terminal: Failed to start PTY", error);
      this.floatingTerminal?.write("\r\n\x1b[31mError: Failed to start terminal.\x1b[0m\r\n");
    }
  }

  private destroyFloatingTerminal() {
    this.floatingResizeObserver?.disconnect();
    this.floatingResizeObserver = null;

    if (this.floatingPtyProcess) {
      this.floatingPtyProcess.kill();
      this.floatingPtyProcess = null;
    }

    if (this.floatingTerminal) {
      this.floatingTerminal.dispose();
      this.floatingTerminal = null;
    }

    this.floatingFitAddon = null;

    const content = this.floatingContainer?.querySelector(".claude-terminal-content");
    if (content) {
      content.empty();
    }
  }

  toggleFloatingTerminal() {
    if (this.isFloatingVisible) {
      this.hideFloatingTerminal();
    } else {
      this.showFloatingTerminal();
    }
  }

  showFloatingTerminal() {
    if (!this.floatingContainer) return;

    this.floatingContainer.removeClass("is-hidden");
    this.isFloatingVisible = true;

    if (!this.floatingTerminal) {
      this.initializeFloatingTerminal();
    } else {
      this.floatingFitAddon?.fit();
      this.floatingTerminal.scrollToBottom();
      this.floatingTerminal.focus();
    }
  }

  hideFloatingTerminal() {
    if (!this.floatingContainer) return;
    this.floatingContainer.addClass("is-hidden");
    this.isFloatingVisible = false;
  }
}

class ClaudeTerminalSettingTab extends PluginSettingTab {
  plugin: ClaudeTerminalPlugin;

  constructor(app: App, plugin: ClaudeTerminalPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Shell path")
      .setDesc("Path to the shell executable")
      .addText((text) =>
        text
          .setPlaceholder("/bin/zsh")
          .setValue(this.plugin.settings.shellPath)
          .onChange(async (value) => {
            this.plugin.settings.shellPath = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Auto-launch Claude")
      .setDesc("Automatically run 'claude' command when terminal opens")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoLaunchClaude).onChange(async (value) => {
          this.plugin.settings.autoLaunchClaude = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Font size")
      .setDesc("Terminal font size in pixels")
      .addSlider((slider) =>
        slider
          .setLimits(10, 24, 1)
          .setValue(this.plugin.settings.fontSize)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.fontSize = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
